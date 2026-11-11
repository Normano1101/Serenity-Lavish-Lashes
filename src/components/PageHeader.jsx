// Show a page's title block in the same compact, left-aligned style as the admin dashboard.
export default function PageHeader({ eyebrow, title, subtitle, children }) {
    return (
        <header className="page-header">
            <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
            </div>
            {children}
        </header>
    );
}
