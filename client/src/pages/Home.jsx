import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, Shield, Users, Clock, Award, Star, ArrowRight, Check, Trophy, Target, Dribbble, Activity, Swords } from 'lucide-react';
import { usePublicSettings, usePublicReviews } from '../hooks/useApi';
import { Button } from '../components/ui/Button';

const getSportIcon = (sportName) => {
  const name = sportName.toLowerCase();
  if (name.includes('soccer') || name.includes('futsal') || name.includes('football')) {
    return <Trophy className="w-6 h-6 text-purple-600" />;
  }
  if (name.includes('basketball')) {
    return <Dribbble className="w-6 h-6 text-orange-500" />;
  }
  if (name.includes('badminton')) {
    return <Activity className="w-6 h-6 text-emerald-500" />;
  }
  if (name.includes('volleyball')) {
    return <Target className="w-6 h-6 text-sky-500" />;
  }
  if (name.includes('cricket')) {
    return <Swords className="w-6 h-6 text-amber-500" />;
  }
  return <Star className="w-6 h-6 text-purple-650" />;
};

export const Home = () => {
  const { data: settings } = usePublicSettings();
  const { data: reviews } = usePublicReviews();

  const features = [
    { title: 'Premium Hardwood Flooring', desc: 'Professional grade playing surfaces tailored for safety and performance.', icon: <Award className="w-6 h-6 text-purple-500" /> },
    { title: 'Climate Controlled', desc: 'Fully air-conditioned indoor playground to play comfortably all year round.', icon: <Shield className="w-6 h-6 text-indigo-500" /> },
    { title: 'Smart Booking System', desc: 'Reserve slots instantly. Real-time scheduling prevents double-booking.', icon: <Clock className="w-6 h-6 text-pink-500" /> },
    { title: 'Perfect for Teams', desc: 'Ample space, changing rooms, and guest seating for team events.', icon: <Users className="w-6 h-6 text-blue-500" /> },
  ];

  const sports = settings?.availableSports || ['Futsal', 'Basketball', 'Badminton', 'Volleyball'];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section 
        className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 px-4"
        style={settings?.heroBanner ? {
          backgroundImage: `url(${settings.heroBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}}
      >
        <div className={`absolute inset-0 ${
          settings?.heroBanner 
            ? 'bg-white/90 dark:bg-zinc-950/90 backdrop-blur-[2px]' 
            : 'bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-transparent'
        }`} />
        {!settings?.heroBanner && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.18),rgba(255,255,255,0))]" />
        )}
        {settings?.heroBanner && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        )}
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-6 uppercase tracking-widest border border-purple-500/20">
              {settings?.hero?.tagline || '⚡ Premium Indoor Court'}
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6">
              {settings?.hero?.title1 || 'Experience Sports'} <br />
              <span className="bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600 bg-clip-text text-transparent">
                {settings?.hero?.title2 || 'Like Never Before'}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-650 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              {settings?.hero?.description || 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/booking">
              <Button size="large" variant="primary" className="px-8 py-3.5 text-base">
                Book Court Now <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="large" variant="secondary" className="px-8 py-3.5 text-base">
                Explore Arena
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Available Sports */}
      <section className="py-20 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-zinc-900 dark:text-white">
          Choose Your Sport
        </h2>
        <p className="text-zinc-500 dark:text-zinc-450 mb-12 max-w-md mx-auto">
          One court, endless possibilities. Pick your sport and dominate.
        </p>        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {sports.map((sport, index) => (
            <motion.div
              key={sport}
              whileHover={{ y: -8, scale: 1.02 }}
              className="p-6 rounded-2xl glass-card hover-glow shadow-sm flex flex-col items-center justify-center gap-4 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shadow-inner">
                {getSportIcon(sport)}
              </div>
              <span className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{sport}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-zinc-100/30 dark:bg-zinc-950/20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-zinc-900 dark:text-white mb-4">
              Designed For Athletes
            </h2>
            <p className="text-zinc-500 dark:text-zinc-450 max-w-md mx-auto">
              Our facilities represent the gold standard of indoor recreation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="glass-card hover-glow rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shadow-inner">
                  {feat.icon}
                </div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{feat.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Booking Promo */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-8 md:p-16 text-white text-center relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.3),transparent)]" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
              Flexible Hourly Rates
            </h2>
            <p className="text-purple-200 mb-8 leading-relaxed">
              Rent the court for team sessions or friendly matches. Pricing adjusted based on peak weekend and holiday schedules.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10 text-left bg-white/5 dark:bg-black/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-purple-300">Weekday Rates</h4>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Day Shift: ৳{settings?.pricing?.weekdayDay || 1500}/hr</div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Night Shift: ৳{settings?.pricing?.weekdayNight || 1500}/hr</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-purple-300">Weekend Rates</h4>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Day Shift: ৳{settings?.pricing?.weekendDay || 1500}/hr</div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Night Shift: ৳{settings?.pricing?.weekendNight || 1500}/hr</div>
              </div>
              <div className="space-y-2">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-purple-300">Holiday Rates</h4>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Day Shift: ৳{settings?.pricing?.holidayDay || 1500}/hr</div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Night Shift: ৳{settings?.pricing?.holidayNight || 1500}/hr</div>
              </div>
            </div>
            <Link to="/booking">
              <Button variant="secondary" className="px-8 py-3.5 text-base font-bold text-indigo-900 bg-white hover:bg-zinc-100 transition-all shadow-lg hover:shadow-white/10">
                Book Available Slot <ArrowRight className="w-5 h-5 text-indigo-900" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {reviews && reviews.filter(r => r.isFeatured).length > 0 && (
        <section className="py-20 px-4 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-12">
            What Players Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.filter(r => r.isFeatured).map((rev) => (
              <div
                key={rev._id}
                className="glass-card hover-glow rounded-2xl p-6 shadow-sm text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-450 text-amber-450" />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-650 dark:text-zinc-350 italic mb-6 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
                <div className="font-extrabold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400">
                  - {rev.customerName}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Google Maps / Contact CTA */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-left space-y-6">
            <h2 className="text-3xl md:text-5xl font-extrabold text-zinc-900 dark:text-white">
              Visit Us Today
            </h2>
            <p className="text-zinc-550 dark:text-zinc-400 leading-relaxed text-sm">
              We are conveniently located in downtown. Fully equipped with parking, player lockers, and restrooms. Drop by or shoot us a booking online!
            </p>
            <div className="space-y-4 pt-4 border-t border-zinc-200/50 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Address</h4>
                <p className="text-zinc-800 dark:text-zinc-200 font-semibold">{settings?.contactAddress}</p>
              </div>
              <div>
                <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Hours of Operation</h4>
                <p className="text-zinc-800 dark:text-zinc-200 font-semibold">
                  Weekdays: {settings?.businessHours?.weekday} | Weekends: {settings?.businessHours?.weekend}
                </p>
              </div>
            </div>
          </div>
          <div className="relative h-96 rounded-3xl overflow-hidden border border-zinc-250/60 dark:border-zinc-800/80 shadow-2xl group">
            {/* Inner Shadow Overlay */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_30px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] rounded-3xl z-10" />
            
            {/* Top-Left: Open in Maps button */}
            <a 
              href={settings?.googleMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 left-4 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-205/50 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-lg hover:bg-purple-650 hover:text-white dark:hover:bg-purple-650 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Open in Maps
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Bottom-Left: Address Indicator */}
            <div className="absolute bottom-4 left-4 z-20 bg-zinc-950/90 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white text-xs font-bold shadow-xl flex items-center gap-2 max-w-[85%] sm:max-w-md select-none transition-all hover:bg-black">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="truncate">{settings?.contactAddress || 'Loading address...'}</span>
            </div>

            <iframe
              title="Apex Map Location"
              src={settings?.googleMapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              className="w-full h-full grayscale-[10%] dark:grayscale-[30%] dark:invert-[90%] dark:hue-rotate-[180deg] transition-all duration-300 group-hover:grayscale-0"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
