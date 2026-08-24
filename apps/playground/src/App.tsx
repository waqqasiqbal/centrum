import { useEffect, useMemo, useState } from "react";

type DemoKey = { tenantId: string; tenantName: string; apiKey: string };
type Envelope = {
  requestId: string;
  status: "completed" | "failed";
  output?: {
    kind: "data" | "artifact";
    data?: Array<Record<string, unknown>>;
    artifact?: {
      id: string;
      filename: string;
      byteSize: number;
      downloadUrl: string;
      expiresAt: string;
    };
  };
  pagination?: { nextToken: string | null; hasMore: boolean };
  trace?: {
    capabilitiesUsed?: string[];
    policyDecisions?: string[];
    events?: Array<{ type: string; name: string; durationMs?: number; resultCount?: number }>;
    provider?: string;
    model?: string;
    durationMs: number;
  };
  error?: { code: string; message: string };
};

const examples = [
  "Return my in-stock products over €20, sorted by price descending, 5 per page, as JSON.",
  "Create a PDF containing my active products sorted alphabetically.",
  "List electronics under €100, sorted by price ascending, as JSON.",
];

// Empty in local development (Vite proxies /v1 to the API). Set this to the
// Render API origin for a split Cloudflare Pages + API deployment.
const apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${apiOrigin}${path}`;

export function App() {
  const [instruction, setInstruction] = useState(examples[0]);
  const [keys, setKeys] = useState<DemoKey[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [result, setResult] = useState<Envelope | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "trace" | "raw">("preview");
  const [loading, setLoading] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/v1/demo/keys"))
      .then((response) => response.json())
      .then((body: { keys: DemoKey[] }) => {
        setKeys(body.keys);
        setSelectedKey(body.keys[0]?.apiKey ?? "");
      })
      .catch(() => setKeys([]));
  }, []);

  const rows = result?.output?.kind === "data" ? result.output.data ?? [] : [];
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  async function execute(useContinuation = false) {
    if (!selectedKey || !instruction.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/v1/execute"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-interface-key": selectedKey },
        body: JSON.stringify({
          instruction,
          continuationToken: useContinuation ? continuationToken : null,
          context: { locale: "en-SE", timezone: "Europe/Stockholm" },
          options: { includeTrace: true },
        }),
      });
      const text = await response.text();
      if (!text) throw new Error(`The server returned an empty ${response.status} response.`);
      const envelope = JSON.parse(text) as Envelope;
      setResult(envelope);
      setContinuationToken(envelope.pagination?.nextToken ?? null);
      setActiveTab("preview");
    } catch (error) {
      setResult({
        requestId: "client_error",
        status: "failed",
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "The interface request failed.",
        },
      });
      setContinuationToken(null);
      setActiveTab("preview");
    } finally {
      setLoading(false);
    }
  }

  async function downloadArtifact() {
    const artifact = result?.output?.artifact;
    if (!artifact) return;
    try {
      const artifactUrl = new URL(artifact.downloadUrl, apiOrigin || window.location.origin);
      const expectedOrigin = apiOrigin ? new URL(apiOrigin).origin : window.location.origin;
      if (artifactUrl.origin !== expectedOrigin || !artifactUrl.pathname.startsWith("/v1/artifacts/")) {
        throw new Error("The artifact URL was rejected by the client security policy.");
      }
      const response = await fetch(artifactUrl, {
        headers: { "x-ai-interface-key": selectedKey },
      });
      if (!response.ok) throw new Error(`Artifact download failed with status ${response.status}.`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = artifact.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setResult({
        requestId: result.requestId,
        status: "failed",
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Artifact download failed.",
        },
      });
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="AI Interfaces home">
          <span className="brand-mark">AI</span>
          <span>Interfaces</span>
          <em>prototype 0.1</em>
        </a>
        <div className="status"><span /> Governed runtime</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Natural language in. Typed execution out.</p>
          <h1>APIs that understand intent<br />without surrendering control.</h1>
        </div>
        <p className="hero-copy">
          The model plans. Capabilities execute. Policy decides what crosses the boundary.
          Every result is deterministic, tenant-scoped, and auditable.
        </p>
      </section>

      <section className="workspace">
        <article className="composer panel">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>Describe the outcome</h2></div>
            <select
              aria-label="Tenant API key"
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              {keys.map((key) => <option key={key.tenantId} value={key.apiKey}>{key.tenantName}</option>)}
            </select>
          </div>
          <label htmlFor="instruction">Instruction</label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value);
              setContinuationToken(null);
            }}
            rows={7}
          />
          <div className="examples">
            {examples.map((example, index) => (
              <button key={example} type="button" onClick={() => {
                setInstruction(example);
                setContinuationToken(null);
              }}>
                Example {index + 1}
              </button>
            ))}
          </div>
          <button className="execute" type="button" disabled={loading || !selectedKey} onClick={() => execute()}>
            {loading ? "Executing…" : "Execute interface"} <span>→</span>
          </button>
          {!keys.length && <p className="hint">Start the API server to load local tenant keys.</p>}
        </article>

        <article className="result panel">
          <div className="panel-heading">
            <div><span className="step">02</span><h2>Inspect the result</h2></div>
            {result && <code>{result.requestId.slice(0, 18)}…</code>}
          </div>
          <nav className="tabs" aria-label="Result views">
            {(["preview", "trace", "raw"] as const).map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="result-body">
            {!result && <EmptyState />}
            {result?.error && (
              <div className="error-card">
                <span>{result.error.code}</span>
                <p>{result.error.message}</p>
              </div>
            )}
            {result && !result.error && activeTab === "preview" && (
              <>
                {result.output?.kind === "data" && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={String(row.id ?? index)}>
                            {columns.map((column) => <td key={column}>{format(row[column])}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {result.output?.kind === "artifact" && result.output.artifact && (
                  <div className="artifact-card">
                    <div className="pdf-icon">PDF</div>
                    <div>
                      <h3>{result.output.artifact.filename}</h3>
                      <p>{Math.ceil(result.output.artifact.byteSize / 1024)} KB · Expires in one hour</p>
                    </div>
                    <button type="button" onClick={downloadArtifact}>Download</button>
                  </div>
                )}
                {continuationToken && (
                  <button className="next-page" type="button" disabled={loading} onClick={() => execute(true)}>
                    Load next page →
                  </button>
                )}
              </>
            )}
            {result && !result.error && activeTab === "trace" && <TraceView result={result} />}
            {result && activeTab === "raw" && <pre>{JSON.stringify(result, null, 2)}</pre>}
          </div>
        </article>
      </section>

      <section className="principles">
        <p><b>01</b> Intent is probabilistic</p>
        <p><b>02</b> Authority is deterministic</p>
        <p><b>03</b> Data remains canonical</p>
        <p><b>04</b> Every action is traceable</p>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-orbit"><span /></div>
      <h3>Awaiting an instruction</h3>
      <p>The execution plan, governed result, and audit trace will appear here.</p>
    </div>
  );
}

function TraceView({ result }: { result: Envelope }) {
  return (
    <div className="trace">
      <div className="trace-summary">
        <span>Provider <b>{result.trace?.provider}</b></span>
        <span>Model <b>{result.trace?.model}</b></span>
        <span>Duration <b>{result.trace?.durationMs} ms</b></span>
      </div>
      {result.trace?.events?.map((event, index) => (
        <div className="trace-event" key={`${event.type}-${event.name}-${index}`}>
          <span className={`event-dot ${event.type}`} />
          <div><b>{event.name}</b><small>{event.type.replace("_", " ")}</small></div>
          <time>{event.durationMs != null ? `${event.durationMs} ms` : event.resultCount != null ? `${event.resultCount} rows` : ""}</time>
        </div>
      ))}
      <div className="policy">
        {(result.trace?.policyDecisions ?? []).map((decision) => <span key={decision}>✓ {decision}</span>)}
      </div>
    </div>
  );
}

function format(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-SE");
  return String(value ?? "");
}

