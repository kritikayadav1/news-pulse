import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  GitCompareArrows,
  Layers3,
  LoaderCircle,
  Newspaper,
  Moon,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import sources from "../../shared/sources.json";
import { request } from "./api.js";

const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
const SAVED_KEY = "news-pulse.saved.v1";
const THEME_KEY = "news-pulse.theme.v1";
const CATEGORIES = [
  "All stories",
  "World",
  "India",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Sports",
  "Culture",
];
function categoryOf(topic) {
  const text = `${topic.label} ${(topic.keywords || []).join(" ")}`;
  const rules = [
    [
      "Sports",
      /\b(cricket|football|soccer|tennis|olympic|olympics|tournament|championship|fifa|ipl)\b/i,
    ],
    [
      "Health",
      /\b(health|hospital|vaccine|disease|cancer|medical|doctors|medicine)\b/i,
    ],
    [
      "Technology",
      /\b(ai|artificial intelligence|tech|technology|software|cyber|chip|chips|openai|google|apple)\b/i,
    ],
    [
      "Science",
      /\b(science|scientists|space|nasa|satellite|planet|climate|environment|earthquake|research)\b/i,
    ],
    [
      "Business",
      /\b(business|economy|economic|market|stocks|bank|trade|finance|inflation|tariff|tariffs)\b/i,
    ],
    [
      "Culture",
      /\b(film|movie|music|singer|actor|actress|festival|cinema|museum|artist)\b/i,
    ],
    ["India", /\b(india|indian|delhi|mumbai|modi|bengaluru)\b/i],
  ];
  return rules.find(([, expression]) => expression.test(text))?.[0] || "World";
}
function StoryImage({ topic, className = "", eager = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [topic?.image_url]);
  const src = safeUrl(topic?.image_url);
  return (
    <div
      className={`story-image ${className} ${src && !failed ? "has-photo" : "image-fallback"}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <Globe2 size={70} strokeWidth={0.8} />
          <span>{topic ? categoryOf(topic) : "THE WORLD, IN PERSPECTIVE"}</span>
        </>
      )}
    </div>
  );
}
function Headlines({ clusters, onSelect, onTimeline }) {
  const [slide, setSlide] = useState(0);
  const [limit, setLimit] = useState(8);
  useEffect(() => {
    setSlide(0);
    setLimit(8);
  }, [clusters]);
  const featured = [...clusters]
    .sort(
      (a, b) =>
        Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)) ||
        b.article_count - a.article_count,
    )
    .slice(0, 4);
  const lead = featured[Math.min(slide, featured.length - 1)];
  const cards = clusters.filter((c) => c.id !== lead?.id);
  const trending = [...clusters]
    .sort(
      (a, b) => b.article_count - a.article_count || b.end.localeCompare(a.end),
    )
    .slice(0, 5);
  return (
    <div className="headlines-layout">
      <section className="headline-main" aria-label="News headlines">
        <article className="lead-story">
          <StoryImage topic={lead} eager />
          <div className="lead-shade" />
          <div className="lead-content">
            <span
              className={`category-tag category-${categoryOf(lead).toLowerCase()}`}
            >
              {categoryOf(lead)}
            </span>
            <h2>
              <button onClick={() => onSelect(lead.id)}>{lead.label}</button>
            </h2>
            {lead.summary && <p>{lead.summary}</p>}
            <div className="lead-meta">
              <span>{ago(lead.end)}</span>
              <span>
                {lead.article_count}{" "}
                {lead.article_count === 1 ? "article" : "articles"} ·{" "}
                {lead.sources.length}{" "}
                {lead.sources.length === 1 ? "source" : "sources"}
              </span>
            </div>
          </div>
          <div className="slide-controls" aria-label="Featured stories">
            {featured.map((c, i) => (
              <button
                key={c.id}
                className={i === slide ? "active" : ""}
                aria-label={`Show featured story ${i + 1}`}
                aria-pressed={i === slide}
                onClick={() => setSlide(i)}
              />
            ))}
          </div>
          {lead.image_source && (
            <span className="image-credit">
              Image: {sourceById[lead.image_source]?.name}
            </span>
          )}
        </article>
        <div className="section-title">
          <h2>Beyond the headlines</h2>
          <span>{clusters.length} topics in this edition</span>
        </div>
        <div className="headline-grid">
          {cards.slice(0, limit).map((topic) => (
            <article className="news-card" key={topic.id}>
              <button
                className="card-image-button"
                aria-label={`Explore story: ${topic.label}`}
                onClick={() => onSelect(topic.id)}
              >
                <StoryImage topic={topic} />
              </button>
              <div className="news-card-body">
                <span
                  className={`category-tag category-${categoryOf(topic).toLowerCase()}`}
                >
                  {categoryOf(topic)}
                </span>
                <h3>
                  <button onClick={() => onSelect(topic.id)}>
                    {topic.label}
                  </button>
                </h3>
                <p>
                  {topic.summary ||
                    "Follow this topic to read the original reporting and compare its coverage."}
                </p>
                <div className="card-bottom">
                  <time dateTime={topic.end}>{ago(topic.end)}</time>
                  <button
                    onClick={() => onSelect(topic.id)}
                    aria-label={`Read coverage: ${topic.label}`}
                  >
                    {topic.sources.length}{" "}
                    {topic.sources.length === 1 ? "source" : "sources"}
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {cards.length > limit && (
          <button
            className="load-more headlines-more"
            onClick={() => setLimit((n) => n + 8)}
          >
            More stories
            <ChevronDown size={16} />
          </button>
        )}
      </section>
      <aside className="news-sidebar">
        <section className="trending-panel">
          <div className="section-title">
            <h2>
              <TrendingUp size={21} />
              Trending in this view
            </h2>
          </div>
          <p className="trending-caption">Ranked by collected article count</p>
          <ol>
            {trending.map((topic, i) => (
              <li key={topic.id}>
                <span className="trend-rank">{i + 1}</span>
                <button onClick={() => onSelect(topic.id)}>
                  <StoryImage topic={topic} />
                  <span>
                    <strong>{topic.label}</strong>
                    <small>
                      {topic.article_count}{" "}
                      {topic.article_count === 1 ? "article" : "articles"} ·{" "}
                      {ago(topic.end)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="perspective-card">
          <span className="perspective-icon">
            <GitCompareArrows size={24} />
          </span>
          <h2>One story. More perspectives.</h2>
          <p>
            See how different newsrooms cover the same event. Follow the
            timeline and compare their reporting.
          </p>
          <button className="primary-button" onClick={onTimeline}>
            Explore the timeline
            <ArrowRight size={16} />
          </button>
        </section>
        <section className="reader-note">
          <BookOpen size={24} />
          <p>
            Read widely.
            <br />
            <strong>Make up your own mind.</strong>
          </p>
          <span>Original reporting. Clear connections.</span>
        </section>
      </aside>
    </div>
  );
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (a) =>
              a &&
              typeof a.id === "string" &&
              typeof a.title === "string" &&
              typeof a.summary === "string" &&
              sourceById[a.source_id] &&
              safeUrl(a.url) &&
              Number.isFinite(Date.parse(a.published_at)),
          )
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
const prettyDate = (date) =>
  new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const dateOnly = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
function ago(date) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 60000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function TopicTimeline({ clusters, selected, onSelect }) {
  const [visible, setVisible] = useState(12);
  useEffect(() => setVisible(12), [clusters]);
  const [start, end] = useMemo(() => {
    if (!clusters.length) return [Date.now() - 86400000, Date.now()];
    const min = Math.min(...clusters.map((c) => Date.parse(c.start)));
    const max = Math.max(...clusters.map((c) => Date.parse(c.end)));
    const padding = Math.max((max - min) * 0.06, 1800000);
    return [min - padding, max + padding];
  }, [clusters]);
  const ticks = Array.from(
    { length: 5 },
    (_, i) => new Date(start + ((end - start) * i) / 4),
  );
  return (
    <>
      <div
        className="timeline-scroll"
        tabIndex="0"
        aria-label="Scrollable news timeline"
      >
        <div className="timeline-grid">
          <div className="axis">
            <div className="axis-heading">TOPIC</div>
            <div className="axis-times">
              {ticks.map((t, i) => (
                <span key={i} style={{ left: `${i * 25}%` }}>
                  <b>{dateOnly(t)}</b>
                  {t.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ))}
            </div>
          </div>
          {clusters.slice(0, visible).map((cluster, index) => {
            const left =
              ((Date.parse(cluster.start) - start) / (end - start)) * 100;
            const width =
              ((Date.parse(cluster.end) - Date.parse(cluster.start)) /
                (end - start)) *
              100;
            return (
              <button
                key={cluster.id}
                className={`timeline-row ${selected === cluster.id ? "selected" : ""}`}
                aria-pressed={selected === cluster.id}
                onClick={() => onSelect(cluster.id)}
                aria-label={`${cluster.label}, ${cluster.article_count} articles, ${prettyDate(cluster.start)} to ${prettyDate(cluster.end)}`}
              >
                <div className="topic-label">
                  <span className="topic-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{cluster.label}</strong>
                    <span className="topic-sources">
                      {cluster.sources.map((id) => (
                        <span
                          className="source-dot"
                          key={id}
                          style={{ background: sourceById[id]?.color }}
                        />
                      ))}
                      {cluster.sources.length}{" "}
                      {cluster.sources.length === 1 ? "source" : "sources"}
                    </span>
                  </div>
                </div>
                <div className="track">
                  {[0, 25, 50, 75, 100].map((n) => (
                    <span
                      className="grid-line"
                      key={n}
                      style={{ left: `${n}%` }}
                    />
                  ))}
                  <span
                    className={`timeline-bar ${width === 0 ? "single" : ""}`}
                    style={{
                      left: `${left}%`,
                      width: width === 0 ? "16px" : `${Math.max(width, 0.5)}%`,
                      "--strength": 0.28 + cluster.intensity * 0.72,
                    }}
                  >
                    <i />
                    <i />
                  </span>
                  <span
                    className="bar-count"
                    style={{
                      left: `clamp(12px, ${left + width / 2}%, calc(100% - 12px))`,
                    }}
                  >
                    {cluster.article_count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="timeline-bottom">
        <span>
          <span className="legend-line" /> First to latest article
        </span>
        <span>All times local</span>
      </div>
      {visible < clusters.length && (
        <button className="load-more" onClick={() => setVisible((v) => v + 12)}>
          Show more topics ({clusters.length - visible}){" "}
          <ChevronDown size={16} />
        </button>
      )}
    </>
  );
}

function ArticleCard({ article, demo, saved, onSave }) {
  const outlet = sourceById[article.source_id];
  const link = safeUrl(article.url);
  return (
    <div className="article-card">
      <div className="article-meta">
        <span
          className="outlet-avatar"
          style={{ "--source-color": outlet?.color }}
        >
          {outlet?.id === "guardian" ? "G" : outlet?.id === "bbc" ? "B" : "N"}
        </span>
        <strong>{outlet?.name || article.source}</strong>
        <time
          dateTime={article.published_at}
          title={prettyDate(article.published_at)}
        >
          {ago(article.published_at)}
        </time>
      </div>
      <h4>
        {demo || article.sample || !link ? (
          article.title
        ) : (
          <a href={link} target="_blank" rel="noopener noreferrer">
            {article.title}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        )}
      </h4>
      {article.summary && (
        <p>
          {article.summary.length > 300
            ? article.summary.slice(0, 297) + "…"
            : article.summary}
        </p>
      )}
      <div className="article-foot">
        <span>
          <time dateTime={article.published_at}>
            {prettyDate(article.published_at)}
          </time>
          {article.date_estimated && <small>Time estimated</small>}
          {(demo || article.sample) && <small>Fictional sample</small>}
        </span>
        <button
          className={`bookmark-button ${saved ? "is-saved" : ""}`}
          aria-pressed={saved}
          aria-label={`${saved ? "Remove saved" : "Save"} article: ${article.title}`}
          title={saved ? "Remove from reading list" : "Save for later"}
          onClick={() =>
            onSave({ ...article, sample: Boolean(demo || article.sample) })
          }
        >
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>
    </div>
  );
}

function ComparisonDialog({
  open,
  onClose,
  detail,
  cluster,
  enabled,
  savedIds,
  onSave,
  demo,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="comparison-header">
        <div>
          <span className="eyebrow">A WIDER PERSPECTIVE</span>
          <h2 id="comparison-title">Compare the coverage</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close comparison"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <p className="comparison-topic">{cluster?.label}</p>
      <div
        className="comparison-grid"
        style={{ "--columns": Math.max(1, enabled.length) }}
      >
        {sources
          .filter((s) => enabled.includes(s.id))
          .map((source) => {
            const articles =
              detail?.articles.filter((a) => a.source_id === source.id) || [];
            return (
              <section className="comparison-source" key={source.id}>
                <h3>
                  <span
                    className="source-dot"
                    style={{ background: source.color }}
                  />
                  {source.name}
                  <span>{articles.length}</span>
                </h3>
                {articles.length ? (
                  <ul>
                    {articles.map((article) => (
                      <li key={article.id}>
                        <ArticleCard
                          article={article}
                          demo={demo}
                          saved={savedIds.has(article.id)}
                          onSave={onSave}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="comparison-missing">
                    <Newspaper size={25} />
                    <p>
                      No article from this newsroom in this collected topic and
                      time range.
                    </p>
                  </div>
                )}
              </section>
            );
          })}
      </div>
      <p className="detail-note">
        Compare original headlines and summaries. Grouping uses shared keywords;
        this is not a fact-check or a measure of bias.
      </p>
    </dialog>
  );
}

function StoryDetails({
  detail,
  selectedCluster,
  loading,
  error,
  demo,
  onRetry,
  savedIds,
  onSave,
  onCompare,
}) {
  if (!selectedCluster)
    return (
      <aside className="detail-panel empty-detail">
        <div className="empty-detail-art">
          <Newspaper size={44} />
          <span>
            <Search size={23} />
          </span>
        </div>
        <span className="eyebrow">THE STORY BEHIND THE HEADLINE</span>
        <h2>Make the connections.</h2>
        <p>
          Choose a topic to follow its timeline, compare newsrooms and save a
          little perspective for later.
        </p>
      </aside>
    );
  return (
    <aside
      className="detail-panel"
      id="story-details"
      aria-label="Selected story details"
      aria-busy={loading}
    >
      <a href="#timeline" className="back-to-timeline">
        Back to timeline
      </a>
      <div className="detail-heading">
        <span className="eyebrow">
          <BookOpen size={14} /> THE STORY ROOM
        </span>
        <span className="article-total">
          {selectedCluster.article_count}{" "}
          {selectedCluster.article_count === 1 ? "article" : "articles"}
        </span>
      </div>
      <h2>{selectedCluster.label}</h2>
      <div className="detail-window">
        <Clock3 size={14} />
        <span>
          {prettyDate(selectedCluster.start)}
          {selectedCluster.start !== selectedCluster.end && (
            <> – {prettyDate(selectedCluster.end)}</>
          )}
        </span>
      </div>
      <div className="keywords">
        {selectedCluster.keywords.slice(0, 4).map((word) => (
          <span key={word}>{word}</span>
        ))}
      </div>
      <button
        className="compare-button"
        onClick={onCompare}
        disabled={loading || !detail?.articles.length}
      >
        <GitCompareArrows size={17} />
        Compare sources
        <ArrowUpRight size={16} />
      </button>
      <div className="coverage-title">
        <h3>How the story unfolded</h3>
        <span>Oldest first</span>
      </div>
      {loading ? (
        <div className="detail-loading" role="status">
          <LoaderCircle className="spin" size={20} /> Loading articles…
        </div>
      ) : error ? (
        <div className="inline-error" role="alert">
          {error}
          <button className="text-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        <ol className="article-list">
          {detail?.articles.map((article) => (
            <li key={article.id}>
              <span
                className="article-bullet"
                style={{ background: sourceById[article.source_id]?.color }}
              />
              <ArticleCard
                article={article}
                demo={demo}
                saved={savedIds.has(article.id)}
                onSave={onSave}
              />
            </li>
          ))}
        </ol>
      )}
      <p className="detail-note">
        Coverage is grouped by shared words. Articles in a topic may reflect
        different perspectives.
      </p>
    </aside>
  );
}

export default function App() {
  const [theme, setTheme] = useState(readTheme);
  const [view, setView] = useState("discover");
  const [category, setCategory] = useState("All stories");
  const [query, setQuery] = useState("");
  const [savedQuery, setSavedQuery] = useState("");
  const [sortBy, setSortBy] = useState("coverage");
  const [multiOnly, setMultiOnly] = useState(false);
  const [savedArticles, setSavedArticles] = useState(readSaved);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [enabled, setEnabled] = useState(sources.map((s) => s.id));
  const [hours, setHours] = useState("72");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [job, setJob] = useState(null);
  const [notice, setNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [refreshKey, setRefreshKey] = useState("");
  const dialogRef = useRef(null);
  const params = useMemo(
    () => new URLSearchParams({ sources: enabled.join(","), hours }).toString(),
    [enabled, hours],
  );
  const busy = starting || job?.status === "running";
  const refreshDisabled = busy || cooldown > 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* Theme still works for this visit. */
    }
  }, [theme]);
  useEffect(() => {
    const shortcut = (event) => {
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.target.closest(
          "input, textarea, select, [contenteditable=true]",
        ) &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        document.getElementById("topic-search")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [view]);
  useEffect(() => {
    let timer;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((cooldownUntil - Date.now()) / 1000),
      );
      setCooldown(remaining);
      if (!remaining) clearInterval(timer);
    };
    tick();
    if (cooldownUntil <= Date.now()) return;
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request(`/timeline?${params}`, { signal: controller.signal })
      .then((next) => {
        setData(next);
        if (next.meta.active_job_id)
          setJob((previous) =>
            previous?.id === next.meta.active_job_id
              ? previous
              : {
                  id: next.meta.active_job_id,
                  status: "running",
                  progress: 0,
                  message: "News collection is running",
                },
          );
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [params, revision]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    request(`/clusters/${selected}?${params}`, { signal: controller.signal })
      .then(setDetail)
      .catch((err) => {
        if (err.name !== "AbortError") setDetailError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, params, revision, detailRevision]);

  useEffect(() => {
    if (!job?.id || job.status !== "running") return;
    const controller = new AbortController();
    let timer;
    let failures = 0;
    async function poll() {
      try {
        const next = await request(`/ingest/status/${job.id}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        failures = 0;
        setJob(next);
        if (next.status === "completed") {
          setNotice(
            `${next.result.new_articles} new articles collected. Your timeline is up to date.`,
          );
          setRevision((n) => n + 1);
          return;
        }
        if (next.status === "failed") {
          setError(next.error || "Collection failed. Please try again.");
          return;
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        failures++;
        if (failures >= 5) {
          setError(
            "Lost connection while checking progress. Reload the page to reconnect to the job.",
          );
          setJob((j) => ({ ...j, status: "unknown" }));
          return;
        }
      }
      timer = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (showKey) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [showKey]);

  const startRefresh = useCallback(async (key) => {
    setStarting(true);
    setNotice("");
    try {
      const next = await request("/ingest/trigger", {
        method: "POST",
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
      setError("");
      setJob({
        id: next.job_id,
        status: "running",
        progress: 0,
        message: "Connecting to news sources",
      });
      setShowKey(false);
      setRefreshKey("");
    } catch (err) {
      if (err.status === 409 && err.data.job_id) {
        setJob({
          id: err.data.job_id,
          status: "running",
          progress: 0,
          message: "Following the current refresh",
        });
        setShowKey(false);
      } else if (err.status === 429) {
        setCooldownUntil(Date.now() + Math.max(1, err.retryAfter || 60) * 1000);
        setNotice(
          "A collection was requested recently. The refresh button will be available again shortly.",
        );
      } else if (err.status === 401) {
        setShowKey(true);
        setError("Enter the refresh key configured by the site owner.");
      } else setError(err.message);
    } finally {
      setStarting(false);
    }
  }, []);

  const clusters = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return (data?.clusters || [])
      .filter((c) => {
        const text = `${c.label} ${c.keywords.join(" ")}`.toLowerCase();
        return (
          (category === "All stories" || categoryOf(c) === category) &&
          (!multiOnly || c.sources.length > 1) &&
          words.every((word) => text.includes(word))
        );
      })
      .sort((a, b) =>
        sortBy === "latest"
          ? b.end.localeCompare(a.end) || b.article_count - a.article_count
          : b.article_count - a.article_count || b.end.localeCompare(a.end),
      );
  }, [data, query, multiOnly, sortBy, category]);
  useEffect(() => {
    setSelected((previous) =>
      clusters.some((c) => c.id === previous)
        ? previous
        : clusters[0]?.id || null,
    );
  }, [clusters]);
  const savedIds = useMemo(
    () => new Set(savedArticles.map((a) => a.id)),
    [savedArticles],
  );
  const visibleSaved = savedArticles.filter((a) =>
    `${a.title} ${a.summary} ${sourceById[a.source_id]?.name}`
      .toLowerCase()
      .includes(savedQuery.trim().toLowerCase()),
  );
  const toggleSaved = (article) => {
    const removing = savedIds.has(article.id);
    if (!removing && savedArticles.length >= 200) {
      setNotice(
        "Your reading list has 200 articles. Remove one before saving another.",
      );
      return;
    }
    const next = removing
      ? savedArticles.filter((a) => a.id !== article.id)
      : [
          {
            id: article.id,
            title: article.title,
            url: article.url,
            source_id: article.source_id,
            source: article.source,
            published_at: article.published_at,
            summary: article.summary || "",
            date_estimated: Boolean(article.date_estimated),
            sample: Boolean(article.sample),
            saved_at: new Date().toISOString(),
          },
          ...savedArticles,
        ];
    setSavedArticles(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setNotice(
        removing
          ? "Article removed from your reading list."
          : "Saved for later. Find it in your reading list.",
      );
    } catch {
      setNotice(
        "Saved for this visit. Your browser is not allowing permanent storage.",
      );
    }
  };
  const meta = data?.meta;
  const selectedCluster = clusters.find((c) => c.id === selected);
  const lastIngest = meta?.last_ingest;
  const demo = meta?.data_mode === "demo";
  const warnings = lastIngest?.warnings || [];
  const multiCount = clusters.filter((c) => c.sources.length > 1).length;
  const articleCount = clusters.reduce(
    (total, c) => total + c.article_count,
    0,
  );
  const sourceCount = new Set(clusters.flatMap((c) => c.sources)).size;
  const selectTopic = (id, scroll = false) => {
    setSelected(id);
    setView("timeline");
    if (scroll || window.matchMedia("(max-width: 900px)").matches)
      requestAnimationFrame(() =>
        document
          .getElementById("story-details")
          ?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
            block: "start",
          }),
      );
  };
  const toggleSource = (id) =>
    setEnabled((previous) =>
      previous.includes(id)
        ? previous.filter((x) => x !== id)
        : [...previous, id],
    );
  const refresh = () =>
    meta?.ingest_requires_token ? setShowKey(true) : startRefresh("");

  return (
    <>
      <a className="skip-link" href="#timeline">
        Skip to timeline
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="/" className="brand">
            <span className="brand-mark">
              <Newspaper size={27} strokeWidth={2} />
            </span>
            <span>
              News<span className="brand-pulse">Pulse</span>
              <small>Real news. A wider perspective.</small>
            </span>
          </a>
          <label className="search-box header-search">
            <Search size={20} />
            <input
              id="topic-search"
              type="search"
              placeholder={
                view === "saved"
                  ? "Search your saved articles…"
                  : "Search news, topics or keywords…"
              }
              aria-label={
                view === "saved" ? "Search saved articles" : "Search topics"
              }
              value={view === "saved" ? savedQuery : query}
              onChange={(event) =>
                view === "saved"
                  ? setSavedQuery(event.target.value)
                  : setQuery(event.target.value)
              }
            />
            <kbd>/</kbd>
          </label>
          <div className="header-right">
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={() =>
                setTheme((t) => (t === "light" ? "dark" : "light"))
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button
              className={`saved-shortcut ${view === "saved" ? "active" : ""}`}
              aria-label={`Reading list, ${savedArticles.length} saved articles`}
              onClick={() => setView("saved")}
            >
              <Bookmark size={17} />
              <span>Saved</span>
              <b>{savedArticles.length}</b>
            </button>
            <button
              className="primary-button header-refresh"
              aria-label="Refresh data"
              disabled={refreshDisabled}
              onClick={refresh}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              <span>
                {busy ? "Refreshing…" : cooldown ? `${cooldown}s` : "Refresh"}
              </span>
            </button>
          </div>
        </div>
        <div className="category-strip">
          <nav aria-label="News categories">
            {CATEGORIES.map((name) => (
              <button
                key={name}
                className={
                  category === name && view !== "saved" ? "active" : ""
                }
                aria-pressed={category === name && view !== "saved"}
                onClick={() => {
                  setCategory(name);
                  setView("discover");
                }}
              >
                {name}
              </button>
            ))}
          </nav>
          <span className="edition-meta">
            <Globe2 size={14} />
            World edition<span>·</span>
            {new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </header>
      <main>
        <div className="briefing-bar">
          <h1>
            {view === "saved"
              ? "Your reading list"
              : view === "timeline"
                ? "Follow the story"
                : "Your daily briefing"}
            <span>.</span>
          </h1>
          <span className="update-time">
            <span className="source-dot" />
            {lastIngest
              ? `Collected ${ago(lastIngest.completed_at)}`
              : "Collect news to build your first edition"}
          </span>
        </div>
        {demo && (
          <div className="sample-banner">
            <strong>Sample preview</strong> These stories are fictional
            examples. Refresh data to replace them with real news.
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <div>
              <button
                className="text-button"
                onClick={() => setRevision((n) => n + 1)}
              >
                Reload view
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}
        {notice && !error && (
          <div className="success-banner" role="status">
            <Check size={16} />
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss notice"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="job-progress" role="status">
            <div>
              <LoaderCircle size={16} className="spin" />
              <span>{job?.message || "Starting collection…"}</span>
              <b>{job?.progress || 0}%</b>
            </div>
            <progress
              max="100"
              value={job?.progress || 0}
              aria-label="News collection progress"
            />
          </div>
        )}
        {view !== "saved" ? (
          <>
            {view === "timeline" && (
              <section className="stats" aria-label="News overview">
                {[
                  {
                    title: "Articles in view",
                    value: data ? articleCount : undefined,
                    icon: Newspaper,
                    note: "Stories worth a closer look",
                    color: "blue",
                  },
                  {
                    title: "Connected topics",
                    value: data ? clusters.length : undefined,
                    icon: Layers3,
                    note: "Follow the bigger picture",
                    color: "purple",
                  },
                  {
                    title: "Newsrooms in view",
                    value: data ? sourceCount : undefined,
                    icon: Globe2,
                    note: "Different perspectives",
                    color: "teal",
                  },
                  {
                    title: "Across sources",
                    value: data ? multiCount : undefined,
                    icon: GitCompareArrows,
                    note: "Topics in 2+ newsrooms",
                    color: "amber",
                  },
                ].map(({ title, value, icon: Icon, note, color }) => (
                  <div className="stat" key={title}>
                    <div>
                      <span className="stat-label">{title}</span>
                      <div className="stat-value">
                        {value ?? "—"}
                        <span>{note}</span>
                      </div>
                    </div>
                    <span className={`stat-icon ${color}`}>
                      <Icon size={21} />
                    </span>
                  </div>
                ))}
              </section>
            )}
            <section className="reader-tools" aria-label="Explore controls">
              <div className="search-row">
                <nav className="view-tabs" aria-label="Reader view">
                  <button
                    className={view === "discover" ? "active" : ""}
                    aria-pressed={view === "discover"}
                    onClick={() => setView("discover")}
                  >
                    <Newspaper size={16} />
                    Headlines
                  </button>
                  <button
                    className={view === "timeline" ? "active" : ""}
                    aria-pressed={view === "timeline"}
                    onClick={() => setView("timeline")}
                  >
                    <Layers3 size={16} />
                    Topic timeline
                  </button>
                </nav>
                <button
                  className={`coverage-filter ${multiOnly ? "enabled" : ""}`}
                  aria-pressed={multiOnly}
                  onClick={() => setMultiOnly((value) => !value)}
                >
                  <GitCompareArrows size={16} />
                  Multiple sources{multiOnly && <Check size={14} />}
                </button>
                <label className="sort-filter">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Sort topics"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="coverage">Most articles</option>
                    <option value="latest">Latest first</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              <section className="filters" aria-label="Filter news">
                <div className="source-filters">
                  <span className="filter-label">YOUR NEWSROOMS</span>
                  {sources.map((s) => (
                    <button
                      key={s.id}
                      className={`source-chip ${enabled.includes(s.id) ? "enabled" : ""}`}
                      aria-pressed={enabled.includes(s.id)}
                      onClick={() => toggleSource(s.id)}
                    >
                      <span
                        className="source-dot"
                        style={{ background: s.color }}
                      />
                      {s.name}
                      {enabled.includes(s.id) && <Check size={13} />}
                    </button>
                  ))}
                </div>
                <label className="range-filter">
                  <Clock3 size={15} />
                  <select
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    aria-label="Time range"
                  >
                    <option value="24">Past 24 hours</option>
                    <option value="72">Past 3 days</option>
                    <option value="168">Past 7 days</option>
                    <option value="720">Past 30 days</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </section>
            </section>
            {view === "discover" && !loading && clusters.length > 0 ? (
              <Headlines
                clusters={clusters}
                onSelect={(id) => selectTopic(id, true)}
                onTimeline={() => setView("timeline")}
              />
            ) : (
              <div className="workspace">
                <section
                  className="timeline-panel"
                  id="timeline"
                  aria-busy={loading}
                >
                  <div className="panel-heading">
                    <div>
                      <h2>Topic timeline</h2>
                      <p>
                        {sortBy === "latest"
                          ? "Latest coverage first."
                          : "Most covered topics first."}{" "}
                        Select a story to see the connections.
                      </p>
                    </div>
                    <span className="topic-badge">
                      {clusters.length}{" "}
                      {clusters.length === 1 ? "topic" : "topics"}
                    </span>
                  </div>
                  {loading ? (
                    <div className="loading-state" role="status">
                      <LoaderCircle size={28} className="spin" />
                      <h3>Connecting the headlines</h3>
                      <p>Loading your news timeline…</p>
                    </div>
                  ) : clusters.length ? (
                    <TopicTimeline
                      clusters={clusters}
                      selected={selected}
                      onSelect={(id) => selectTopic(id)}
                    />
                  ) : (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Radio size={32} />
                      </span>
                      <h3>
                        {!enabled.length
                          ? "Choose your sources"
                          : query || multiOnly || category !== "All stories"
                            ? "No matching topics"
                            : lastIngest
                              ? "No stories in this view"
                              : "Your next perspective starts here"}
                      </h3>
                      <p>
                        {!enabled.length
                          ? "Select at least one news source above."
                          : query || multiOnly || category !== "All stories"
                            ? "Try another keyword, category or include topics covered by a single newsroom."
                            : lastIngest
                              ? "Try a wider time range or refresh the news."
                              : "Bring together the latest headlines from three newsrooms."}
                      </p>
                      {enabled.length > 0 &&
                        (query || multiOnly || category !== "All stories" ? (
                          <button
                            className="primary-button"
                            onClick={() => {
                              setQuery("");
                              setMultiOnly(false);
                              setCategory("All stories");
                            }}
                          >
                            Clear search and filters
                          </button>
                        ) : (
                          <button
                            className="primary-button"
                            disabled={refreshDisabled}
                            onClick={refresh}
                          >
                            <RefreshCw size={16} />
                            {busy
                              ? "Collecting news…"
                              : cooldown
                                ? `Refresh in ${cooldown}s`
                                : "Collect latest news"}
                          </button>
                        ))}
                    </div>
                  )}
                </section>
                <StoryDetails
                  detail={detail}
                  selectedCluster={selectedCluster}
                  loading={detailLoading}
                  error={detailError}
                  demo={demo}
                  onRetry={() => setDetailRevision((n) => n + 1)}
                  savedIds={savedIds}
                  onSave={toggleSaved}
                  onCompare={() => setCompareOpen(true)}
                />
              </div>
            )}
          </>
        ) : (
          <section className="reading-list" aria-label="Saved articles">
            <div className="reading-list-heading">
              <div>
                <h2>A shelf for your curiosity.</h2>
                <p>
                  {savedArticles.length}{" "}
                  {savedArticles.length === 1 ? "article" : "articles"} saved ·
                  Available on this browser
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setView("discover")}
              >
                Back to headlines
              </button>
            </div>
            {visibleSaved.length ? (
              <ul className="saved-grid">
                {visibleSaved.map((article) => (
                  <li key={article.id}>
                    <ArticleCard
                      article={article}
                      demo={article.sample}
                      saved={true}
                      onSave={toggleSaved}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  <Bookmark size={32} />
                </span>
                <h3>
                  {savedQuery
                    ? "No saved articles match"
                    : "Keep a story for later."}
                </h3>
                <p>
                  {savedQuery
                    ? "Try another headline, keyword or newsroom."
                    : "Tap the bookmark on any article. Your own little reading corner starts here."}
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    if (savedQuery) setSavedQuery("");
                    else setView("discover");
                  }}
                >
                  {savedQuery ? "Clear search" : "Discover the stories"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {warnings.length > 0 && (
          <details className="source-notes">
            <summary>Collection notes ({warnings.length})</summary>
            <ul>
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
        <footer>
          <span className="footer-brand">
            <Activity size={15} /> News Pulse
          </span>
          <span>Original reporting belongs to its publishers.</span>
          <span>
            {demo ? "Sample data" : "Public RSS feeds"} · All times local
          </span>
        </footer>
      </main>
      <ComparisonDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        detail={detail}
        cluster={selectedCluster}
        enabled={enabled}
        savedIds={savedIds}
        onSave={toggleSaved}
        demo={demo}
      />
      <dialog
        ref={dialogRef}
        className="key-dialog"
        onCancel={() => setShowKey(false)}
        onClose={() => setShowKey(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startRefresh(refreshKey);
          }}
        >
          <div className="dialog-heading">
            <h2>Refresh key</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowKey(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <p>
            This site requires a key to collect new articles. Reading existing
            news stays open.
          </p>
          <label htmlFor="refresh-key">Key</label>
          <input
            id="refresh-key"
            autoFocus
            type="password"
            value={refreshKey}
            onChange={(e) => setRefreshKey(e.target.value)}
            required
            autoComplete="off"
          />
          {error && (
            <p className="key-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={starting} type="submit">
            {starting ? "Starting…" : "Refresh news"}
          </button>
        </form>
      </dialog>
    </>
  );
}
