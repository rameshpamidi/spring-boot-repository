package com.dotridge.nhc.controller;

import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import com.dotridge.nhc.entity.UserProfile;
import com.dotridge.nhc.model.HospitalBean;
import com.dotridge.nhc.model.LoginBean;
import com.dotridge.nhc.service.HospitalService;
import com.dotridge.nhc.service.UserDetailsService;

/**
 * The Class LoginController.
 */
@Controller
public class LoginController {

	public static Logger logger = Logger.getLogger(LoginController.class);

	@Autowired
	private UserDetailsService userDetailsService;

	@Autowired
	private HospitalService hospitalService;

	/**
	 * Show login form.
	 *
	 * @param model
	 *            the model
	 * @return the string
	 */
	@RequestMapping(value = { "/loginPage" }, method = RequestMethod.GET)
	public String showLoginForm(Model model) {
		if (logger.isDebugEnabled()) {
			logger.debug("[show loginform handler method]--> execution started..!");
			logger.info("loginPage handler rendering requested view page");
		}
		model.addAttribute("loginForm", new LoginBean());
		return "loginpage/loginPage";
	}

	@RequestMapping(value = { "/login" }, method = RequestMethod.POST)
	public String submitLoginForm(@Valid @ModelAttribute("loginForm") LoginBean loginForm, BindingResult result,
			HttpServletRequest request, Model model) {
		String viewPage = null;
		if (result.hasErrors()) {
			viewPage = "loginpage/loginPage";
		} else {
			UserProfile user = userDetailsService.getUserByUserName(loginForm.getUserName());
			logger.info("fetching user information based on user name");
			if (user != null && user.getUserName().equals(loginForm.getUserName())
					&& user.getPassword().equals(loginForm.getPassword())) {
				switch (user.getUserName().toUpperCase()) {
				case "SUPERADMIN":
					model.addAttribute("name",user.getFullName());
					viewPage = superAdminDashBoard(model);
					break;
				case "ADMIN":
					viewPage = "admin/superadmin";
					break;

				default:
					break;

				}
			}

			else {
				model.addAttribute("msg", "invalid username (or) password");
				viewPage = "loginpage/loginPage";
			}

		}
		return viewPage;

	}

	/**
	 * Logout action.
	 *
	 * @param request
	 *            the request
	 * @return the string
	 */
	/*
	 * @RequestMapping(value = { "/logout" }, method = RequestMethod.GET) public
	 * String logoutAction(HttpServletRequest request, Model model) { if
	 * (request.getSession(false) != null) {
	 * request.getSession(false).invalidate(); model.addAttribute("loginForm",
	 * new LoginBean()); return "redirect:/"; } else { System.out.println(
	 * "logout failed"); return null; } }
	 */
	@RequestMapping(value = { "/dashboard" }, method = RequestMethod.GET)
	public String superAdminDashBoard(Model model) {
		logger.debug("[superadmin dashboard handler method]--> execution started..!");
		logger.debug("retrieving authenticated user principal from request scope");

		String viewPage = null;
		logger.debug("getting all hospitals to show on superadmin dashboard");
		List<HospitalBean> allHospitals = hospitalService.getAllHospitals();
		if (allHospitals != null) {
			logger.info("successfully retrived existed hospitals ");
			logger.info("retrived hospitals from database are:" + allHospitals.toString());
			model.addAttribute("totalhospitals", allHospitals.size());
			logger.debug("binding count of hospitals to model object");
			logger.debug("binding user name  to model object");
			viewPage = "superadmin/superAdminDashBoard";

		}
		logger.debug("handovering view page and model object to viewResolver");
		return viewPage;

	}

}