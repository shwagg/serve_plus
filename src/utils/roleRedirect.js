export function getRoleRedirectPath(role) {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard";
    case "sysadmin":
      return "/sysadmin/roster";
    case "faculty":
      return "/faculty/current-event";
    case "partner":
      return "/partner/dashboard";
    case "student":
      return "/student/home";
    default:
      return "/profile";
  }
}
