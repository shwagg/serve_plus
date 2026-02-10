//icons
import {
    HomeRoundedIcon,
    ListAltIcon,
    DesignServicesOutlinedIcon,
    SettingsOutlinedIcon,
} from "../components/icons/index";

//admin side
export const adminLinks = [
    {
        key: "dashboard",
        label: "Dashboard",
        children: [
            { label: "Program Impact Metrics", to: "/admin/dashboard/metrics" },
            { label: "SDG", to: "/admin/dashboard/sdg" },
        ],
    },
    {
        key: "events",
        label: "Events",
        children: [
            { label: "Current Event", to: "/admin/events/current" },
            { label: "Roster", to: "/admin/events/roster" },
            { label: "Partner Hub", to: "/admin/events/partners" },
        ],
    },
    {
        key: "project",
        label: "Project",
        children: [
            { label: "Project List", to: "/admin/projects" },
            { label: "Badge & Points", to: "/admin/projects/badges" },
        ],
    },
    {
        key: "forms",
        label: "Forms",
        children: [
            { label: "Document Library", to: "/admin/documents" },
        ],
    },
    {
        key: "system",
        label: "System",
        children: [
            { label: "System Activity Log", to: "/admin/system/logs" },
            { label: "Students Banner", to: "/admin/system/banner" },
            { label: "Announcement", to: "/admin/system/announcement" },
        ],
    },
];

//partner side
export const partnerLinks = [
    {
        key: "project",
        label: "Project",
        children: [
            { label: "Project List", to: "/admin/projects" },
        ],
    },
];

//faculty side
export const facultyLinks = [
    {
        key: "events",
        label: "Events",
        children: [
            { label: "Current Event", to: "/admin/events/current" },
            { label: "Roster", to: "/admin/events/roster" },
            { label: "Partner Hub", to: "/admin/events/partners" },
        ],
    },
    {
        key: "project",
        label: "Project",
        children: [
            { label: "Project List", to: "/faculty/projects" },
        ],
    },
    {
        key: "forms",
        label: "Forms",
        children: [
            { label: "Document Library", to: "/admin/forms/documents" },
        ],
    },
];