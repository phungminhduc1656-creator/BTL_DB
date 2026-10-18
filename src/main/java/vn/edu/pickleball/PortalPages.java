package vn.edu.pickleball;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Explicit page URLs keep the two workspaces easy to recognize. */
@Controller
public class PortalPages {
    @GetMapping("/khach-hang") public String customerRedirect() { return "redirect:/khach-hang/"; }
    @GetMapping("/khach-hang/") public String customer() { return "forward:/khach-hang/index.html"; }
    @GetMapping("/quan-ly") public String adminRedirect() { return "redirect:/quan-ly/"; }
    @GetMapping("/quan-ly/") public String admin() { return "forward:/index.html"; }
}
