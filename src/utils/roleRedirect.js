import { getFacultyLandingPath } from "./communityChair";

export function getRoleRedirectPath(role, userData = null) {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard";
    case "sysadmin":
      return "/sysadmin/roster";
    case "faculty":
      return getFacultyLandingPath(userData || { role });
    case "partner":
      return "/partner/dashboard";
    case "student":
      return "/student/home";
    default:
      return "/profile";
  }
}
