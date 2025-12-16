import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Heart, Brain, Eye, Newspaper, Hourglass } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex flex-col lg:flex-row gap-16 items-start justify-between">
          <div className="flex-shrink-0 max-w-sm">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              No Distractions,
              <span className="block text-foreground">STAY FOCUSED,</span>
              <span className="block text-red-600">Straight Forward MEDIA</span>
            </h1>
            <div className="flex gap-4 mb-8 items-center">
              <Link to="/signin">
                <Button className="bg-black text-white hover:bg-gray-900 px-8 py-3 text-base">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex gap-2 flex-shrink-0">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2F1e9ffb499d8f4bc1b493208a723d2d5d?format=webp&width=800"
              alt="LockedIn app interface mockup"
              className="h-80 w-auto"
            />
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2F941257f2f48f49df86c49277a1e6f86e?format=webp&width=800"
              alt="No mindless scrolling - stay focused"
              className="h-80 w-auto"
            />
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2F53284484e7df47038aa979c599496a5e?format=webp&width=800"
              alt="App features - fixed scrolling, verified news, low dopamine mode"
              className="h-80 w-auto"
            />
          </div>
        </div>
      </section>

      {/* Features Grid - Be Mindful Section */}
      <section className="w-full bg-gray-100  md:py-24 flex justify-between items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch min-h-96">
            {/* Features Poster - Left Side */}
            <div className="bg-white rounded-lg  flex items-center justify-center">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2Fda395d2f28334322a3962f7a0478796e?format=webp&width=800"
                alt="Features: Digital Wellness, Focus Mode, Content Filtering, Verified News, Fixed Scrolling"
                className="w-full h-auto"
              />
            </div>

            {/* Be Mindful - Right Side */}
            <div className="flex flex-col justify-center items-end">
              <h2 className="text-5xl lg:text-6xl font-bold leading-tight">
                Be
                <span className="block text-red-600 text-6xl lg:text-7xl font-bold mt-2">Mindful!</span>
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* Our App Helps Section */}
      <section className="bg-white border-t border-gray-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="pr-6">
              <h3 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                <span className="text-red-600">Our App</span> Helps you stay aware of your precious
                <span className="block text-red-600">Time!</span>
              </h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Our app keeps you mindful of your time with a finite feed, gentle reminders, and low-dopamine design — helping you connect meaningfully without endless scrolling or losing hours.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-200 flex items-center justify-center">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fda5f8811416846e891b7362c61b366cb%2Fa5eb334962de49558cb21c2bd157349f?format=webp&width=800"
                alt="Addictive vs Mindful comparison"
                className="w-full max-w-md h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-background py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            Ready to Stay Focused?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands who are reclaiming their time and attention.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button className="bg-red-600 hover:bg-red-700 px-8 py-6 text-lg">
                Create Account
              </Button>
            </Link>
            <Link to="/signin">
              <Button variant="outline" className="px-8 py-6 text-lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 LockedIn. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
