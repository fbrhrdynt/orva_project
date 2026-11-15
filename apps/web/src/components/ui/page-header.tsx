import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="orva-page-header">
      <div>
        {eyebrow ? <div className="orva-page-header__eyebrow">{eyebrow}</div> : null}
        <h1 className="orva-page-header__title">{title}</h1>
        {description ? <p className="orva-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="orva-page-header__actions">{actions}</div> : null}
    </header>
  );
}