import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <nav className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2F556c038b85e942c2b15d53e3710e039f?format=webp&width=800" 
            alt="LockedIn Logo" 
            className="h-8"
          />
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-white hover:text-gray-300 text-sm">
            Home
          </Link>
          <a href="#about" className="text-white hover:text-gray-300 text-sm">
            About Us
          </a>
          <Link to="/signin">
            <Button variant="ghost" className="text-white hover:text-gray-300">
              Log in
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-red-600 hover:bg-red-700">
              Create Account
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};
