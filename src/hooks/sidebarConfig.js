//icons
import {
    DashboardOutlinedIcon,
    ListAltIcon,
    AddBoxOutlinedIcon,
    DesignServicesOutlinedIcon,
    SettingsOutlinedIcon,
    ImportContactsOutlinedIcon,
} from "../components/icons/index";

//admin sidebar
export const adminLinks = [
    {
        label: "Dashboard",
        to: "/admin/dashboard",
        icon: DashboardOutlinedIcon,
    },
    {
        label: "Project",
        to: "/admin/projects",
        icon: ListAltIcon,
    },
    {
        label: "Roster",
        to: "/admin/roster",
        icon: ListAltIcon,
    },
    {
        label: "Customize",
        to: "/admin/projects/proposal",
        icon: DesignServicesOutlinedIcon,
    },
    {
        label: "Settings",
        to: "/admin/settings",
        icon: SettingsOutlinedIcon,
    },
    {
        label: "Document Library",
        to: "/admin/documents",
        icon: ImportContactsOutlinedIcon,
    },
];

//partner sidebar
export const partnerLinks = [
    {
        label: "Projects",
        to: "/partner/projects",
        icon: ListAltIcon,
    },
    {
        label: "Settings",
        to: "/partner/settings",
        icon: SettingsOutlinedIcon,
    },
];

//faculty sidebar
export const facultyLinks = [
    {
        label: "Projects",
        to: "/faculty/projects",
        icon: ListAltIcon,
    },
    {
        label: "Settings",
        to: "/faculty/settings",
        icon: SettingsOutlinedIcon,
    },
];