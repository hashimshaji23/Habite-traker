import { useEffect, useState } from "react";
import { Sparkles, ChevronDown, RefreshCw, AlertCircle } from "lucide-react";
import api from "../api/axios.js";
import Markdown from "./Markdown.jsx";

export default function AIWeeklyReport({ defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.get("/ai/weekly-report/latest");
        if (isMounted && res.data?.content) {
          setContent(res.data.content);
          setGeneratedAt(new Date(res.data.createdAt || res.data.generatedAt || Date.now()));
        }
      } catch (err) {
        console.error("Failed to load latest weekly report:", err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/ai/weekly-report");
      if (res.data?.content) {
        setContent(res.data.content);
        setGeneratedAt(new Date(res.data.createdAt || Date.now()));
        setExpanded(true);
      }
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to generate report. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(99,102,241,0.25), transparent 60%)",
        }}
      />
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 text-left relative"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">AI Weekly Report</div>
          <div className="text-xs text-muted">
            {initialLoading ? (
              "Checking for weekly insights..."
            ) : content ? (
              `Generated ${generatedAt ? generatedAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "recently"}`
            ) : (
              "See patterns and personalised encouragement from the past 7 days"
            )}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-faint transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-4 animate-slide-up relative">
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={generate}
                disabled={loading}
                className="underline hover:no-underline font-medium ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {!content && !loading && (
            <button
              onClick={generate}
              disabled={loading}
              className="btn-primary"
            >
              <Sparkles size={14} />
              Generate weekly report
            </button>
          )}

          {loading && !content && (
            <div className="flex items-center gap-2 text-sm text-soft py-4">
              <RefreshCw size={14} className="animate-spin" />
              Analysing your week...
            </div>
          )}

          {content && (
            <>
              <Markdown className="mt-1 glass rounded-xl p-4 text-sm">
                {content}
              </Markdown>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="btn-ghost text-xs flex items-center gap-1.5"
                >
                  <RefreshCw
                    size={13}
                    className={loading ? "animate-spin" : ""}
                  />
                  {loading ? "Regenerating..." : "Regenerate"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

