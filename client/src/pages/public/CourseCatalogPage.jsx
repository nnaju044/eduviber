import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getPublicCourses } from "../../api/publicApi.js";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function CourseCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const searchQuery = searchParams.get("q") || "";

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicCourses({
          page: currentPage,
          limit: 12,
          q: searchQuery,
        });
        if (active) {
          setCourses(data.courses || []);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load course catalog.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCatalog();
    return () => {
      active = false;
    };
  }, [currentPage, searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const q = (form.get("search") || "").toString().trim();
    setSearchParams(q ? { q, page: "1" } : { page: "1" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-200 pb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#CA8A04] block mb-1">
            Storefront
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
            Explore Courses
          </h1>
          <p className="text-sm text-neutral-600 font-medium mt-1">
            Learn practical skills with curated courses taught by certified instructors.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md w-full">
          <input
            type="search"
            name="search"
            defaultValue={searchQuery}
            placeholder="Search courses or instructors..."
            className="flex-1 px-4 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CA8A04] focus:border-transparent"
          />
          <button
            type="submit"
            className="px-5 py-2 text-sm font-semibold text-white bg-black hover:bg-neutral-800 rounded-xl transition-colors shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" text="Loading course catalog..." />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-red-600 underline"
          >
            Try Again
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200/80 p-8">
          <p className="text-base font-bold text-neutral-800">No published courses found.</p>
          <p className="text-xs text-neutral-500 mt-1">
            {searchQuery ? "Try searching for a different keyword." : "Check back soon for newly published courses."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {courses.map((course) => (
            <div
              key={course.id}
              className="group flex flex-col justify-between bg-white border border-neutral-200/80 rounded-2xl overflow-hidden hover:shadow-lg hover:border-black/20 transition-all duration-200"
            >
              <div>
                <div className="aspect-video w-full bg-neutral-100 relative overflow-hidden">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white font-black text-2xl tracking-wider">
                      EDU<span className="text-[#CA8A04]">viber</span>
                    </div>
                  )}
                  <span className="absolute top-3 right-3 px-3 py-1 text-xs font-bold rounded-full bg-white/95 text-neutral-900 backdrop-blur shadow-sm">
                    {course.price > 0 ? `₹${course.price}` : "Free"}
                  </span>
                </div>

                <div className="p-6 space-y-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#CA8A04]">
                    {course.instructor || "Platform Course"}
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 line-clamp-2 group-hover:text-[#CA8A04] transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed font-normal">
                    {course.description || "Comprehensive syllabus with step-by-step video guidance."}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0 border-t border-neutral-100 flex items-center justify-between mt-4">
                <span className="text-xs text-neutral-500 font-medium">
                  {course.totalLessons} {course.totalLessons === 1 ? "lesson" : "lessons"}
                  {course.totalMinutes > 0 ? ` • ${course.totalMinutes}m` : ""}
                </span>
                <Link
                  to={`/app/courses/${course.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-black hover:text-[#CA8A04] transition-colors py-2"
                >
                  <span>View Syllabus</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            disabled={currentPage <= 1}
            onClick={() => setSearchParams({ q: searchQuery, page: String(currentPage - 1) })}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
          >
            Previous
          </button>
          <span className="text-xs text-neutral-600 font-medium px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setSearchParams({ q: searchQuery, page: String(currentPage + 1) })}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

