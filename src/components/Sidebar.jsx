import { NavLink } from "react-router-dom";

export default function Sidebar({ links }) {
    return (
        <aside className="admin-sidebar">
            <nav className="sidebar-nav">
                {links.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className="sidebar-item-link"
                        >
                            <span className="material-icons sidebar-icon">
                                {Icon && <Icon />}
                            </span>
                            <span className="sidebar-label">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
}