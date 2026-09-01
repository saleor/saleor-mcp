import type { ReactNode } from "react";

const ExternalLinkIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
    <path d="M9.5 2.5h4v4M13.2 2.8 7.5 8.5M12.5 8v4.5h-9v-9H8" />
  </svg>
);

const ChevronIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export function AppPageShell({
  children,
  onOpenDocumentation,
}: {
  children: ReactNode;
  onOpenDocumentation?: () => void;
}) {
  return (
    <main className="mcp-app">
      <header className="app-page-header">
        <h1>Configuration</h1>
        <button
          className="documentation-link"
          disabled={!onOpenDocumentation}
          type="button"
          onClick={onOpenDocumentation}
        >
          Documentation
          <ExternalLinkIcon />
        </button>
      </header>
      <div className="detail-page-content">{children}</div>
    </main>
  );
}

export function SettingsPageContent({
  description,
  aside,
  children,
}: {
  description: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settings-page-content">
      <aside className="settings-aside">
        <p className="settings-description">{description}</p>
        {aside}
      </aside>
      <div className="settings-main">{children}</div>
    </div>
  );
}

export function AsideInfoCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="aside-info-card">
      <div className="aside-info-body">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function SettingsSection({
  title,
  description,
  chip,
  headerEnd,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  chip?: ReactNode;
  headerEnd?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <div className="settings-section-title-row">
          <div className="settings-section-title">
            <h2>{title}</h2>
            {chip ? <span className="ownership-chip">{chip}</span> : null}
          </div>
          {headerEnd ? <div className="settings-section-actions">{headerEnd}</div> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

export function CollapsibleSettingsSection({
  title,
  chip,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: ReactNode;
  chip?: ReactNode;
  count?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="settings-section collapsible-settings-section">
      <button
        type="button"
        className="collapsible-settings-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="settings-section-title">
          <span className="collapsible-settings-title">{title}</span>
          {chip ? <span className="ownership-chip">{chip}</span> : null}
        </span>
        <span className="collapsible-settings-meta">
          {count ? <span className="count-badge">{count}</span> : null}
          <ChevronIcon />
        </span>
      </button>
      {expanded ? <div className="settings-section-body">{children}</div> : null}
    </section>
  );
}

export function DashboardLoading() {
  return (
    <AppPageShell>
      <SettingsPageContent
        description="Connect an AI assistant to this Saleor environment. The connection is tied to this app installation."
        aside={
          <div className="aside-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        }
      >
        <section className="settings-section loading-section" aria-label="Loading configuration">
          <div className="loading-section-header">
            <span />
            <span />
          </div>
          <div className="loading-section-body">
            <span />
            <span />
            <span />
          </div>
        </section>
      </SettingsPageContent>
    </AppPageShell>
  );
}
