// The title at the top of each admin panel. Anything inside it (buttons, filters) sits on the right.
export default function PanelHeading({ eyebrow, title, children }) {
    return (
        <div className="admin-panel-heading">
            <div>
                <p className="eyebrow">{eyebrow}</p>
                <h2>{title}</h2>
            </div>
            {children}
        </div>
    );
}
