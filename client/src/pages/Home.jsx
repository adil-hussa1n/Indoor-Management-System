import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Shield,
  Users,
  Clock,
  Award,
  Star,
  ArrowRight,
  Check,
  Trophy,
  Target,
  Dribbble,
  Activity,
  Swords,
  Zap,
  Sparkles,
  TrendingUp,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { usePublicSettings, usePublicReviews, useCreateReview } from '../hooks/useApi';
import { Button } from '../components/ui/Button';

const getSportIcon = (sportName) => {
  const name = sportName.toLowerCase();
  if (name.includes('soccer') || name.includes('futsal') || name.includes('football')) {
    return <Trophy className="w-7 h-7 text-purple-500" />;
  }
  if (name.includes('basketball')) {
    return <Dribbble className="w-7 h-7 text-orange-500" />;
  }
  if (name.includes('badminton')) {
    return <Activity className="w-7 h-7 text-emerald-500" />;
  }
  if (name.includes('volleyball')) {
    return <Target className="w-7 h-7 text-sky-500" />;
  }
  if (name.includes('cricket')) {
    return <Swords className="w-7 h-7 text-amber-500" />;
  }
  return <Star className="w-7 h-7 text-purple-650" />;
};

const getSportColorClass = (sportName) => {
  const name = sportName.toLowerCase();
  if (name.includes('soccer') || name.includes('futsal') || name.includes('football')) {
    return 'group-hover:shadow-purple-500/20 group-hover:border-purple-500/50 bg-purple-500/5 text-purple-500';
  }
  if (name.includes('basketball')) {
    return 'group-hover:shadow-orange-500/20 group-hover:border-orange-500/50 bg-orange-500/5 text-orange-500';
  }
  if (name.includes('badminton')) {
    return 'group-hover:shadow-emerald-500/20 group-hover:border-emerald-500/50 bg-emerald-500/5 text-emerald-500';
  }
  if (name.includes('volleyball')) {
    return 'group-hover:shadow-sky-500/20 group-hover:border-sky-500/50 bg-sky-500/5 text-sky-500';
  }
  if (name.includes('cricket')) {
    return 'group-hover:shadow-amber-500/20 group-hover:border-amber-500/50 bg-amber-500/5 text-amber-500';
  }
  return 'group-hover:shadow-purple-500/20 group-hover:border-purple-500/50 bg-purple-500/5 text-purple-500';
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const Home = () => {
  const { data: settings } = usePublicSettings();
  const { data: reviews } = usePublicReviews();
  const createReviewMutation = useCreateReview();

  // Pricing calculator state
  const [calcDayType, setCalcDayType] = useState('weekday');
  const [calcShift, setCalcShift] = useState('day');

  // Review submission state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!reviewName.trim() || !reviewComment.trim()) {
      setSubmitError('Please fill in all fields.');
      return;
    }
    try {
      await createReviewMutation.mutateAsync({
        customerName: reviewName,
        rating: reviewRating,
        comment: reviewComment,
      });
      setSubmitSuccess(true);
      setReviewName('');
      setReviewComment('');
      setReviewRating(5);
      setTimeout(() => {
        setReviewModalOpen(false);
        setSubmitSuccess(false);
      }, 2500);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit review.');
    }
  };

  const features = [
    {
      title: 'Premium Hardwood Flooring',
      desc: 'FIBA standard impact-absorbing surfaces optimized for joint protection and elite gameplay.',
      icon: <Award className="w-6 h-6 text-purple-500" />
    },
    {
      title: 'Weather Protected & Ventilation',
      desc: 'Play comfortably during rain or sun. Fully roof-protected court with excellent natural air ventilation.',
      icon: <Shield className="w-6 h-6 text-indigo-500" />
    },
    {
      title: 'Instant Automated Slots',
      desc: 'Real-time booking updates, calendar synchronization, and digital receipt delivery.',
      icon: <Clock className="w-6 h-6 text-pink-500" />
    },
    {
      title: 'Integrated Team Amenities',
      desc: 'Clean lockers, individual shower booths, and comfortable spectator lounges.',
      icon: <Users className="w-6 h-6 text-blue-500" />
    },
  ];

  const sports = settings?.availableSports || ['Futsal', 'Basketball', 'Badminton', 'Volleyball'];

  // Pricing Helper mapping
  const getCalculatedPrice = () => {
    const pricing = settings?.pricing || {};
    if (calcDayType === 'weekday') {
      return calcShift === 'day' ? pricing.weekdayDay || 1500 : pricing.weekdayNight || 1800;
    } else if (calcDayType === 'weekend') {
      return calcShift === 'day' ? pricing.weekendDay || 1800 : pricing.weekendNight || 2200;
    } else {
      return calcShift === 'day' ? pricing.holidayDay || 2000 : pricing.holidayNight || 2400;
    }
  };

  return (
    <div className="overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">

      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
        {/* Background Media Layer */}
        {settings?.heroBanner && settings?.hero?.mediaType === 'video' && (
          <video
            src={settings.heroBanner}
            autoPlay
            loop
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-[2s] ${settings?.hero?.blurBackground ? 'blur-[5px] scale-105' : ''
              }`}
          />
        )}
        {settings?.heroBanner && settings?.hero?.mediaType === '360' && (
          <iframe
            title="360° Hero Panorama"
            src={`https://cdn.pannellum.org/2.5/pannellum.htm?panorama=${encodeURIComponent(settings.heroBanner)}&autoLoad=true&autoRotate=${settings?.hero?.autoPlay360 !== false ? '-2' : '0'}`}
            className={`absolute -top-[50px] -left-[50px] w-[calc(100%+100px)] h-[calc(100%+100px)] border-0 [will-change:transform] transition-all duration-[2s] ${settings?.hero?.blurBackground ? 'blur-[5px] scale-105' : ''
              }`}
            allow="accelerometer; gyroscope; magnetometer; vr"
            allowFullScreen
          />
        )}
        {settings?.heroBanner && (!settings?.hero?.mediaType || settings?.hero?.mediaType === 'image') && (
          <div
            className={`absolute inset-0 transition-all duration-[2s] ${settings?.hero?.zoomAnimation ? 'animate-kenburns' : ''
              } ${settings?.hero?.blurBackground ? 'blur-[5px] scale-105' : ''
              }`}
            style={{
              backgroundImage: `url(${settings.heroBanner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Overlay Layers */}
        {(() => {
          const overlayStyle = settings?.hero?.overlayStyle || 'dark';
          let overlayGradient = 'bg-black/60 dark:bg-black/80';

          if (overlayStyle === 'purple') {
            overlayGradient = 'bg-gradient-to-b from-purple-950/80 via-indigo-950/70 to-zinc-950/90';
          } else if (overlayStyle === 'midnight') {
            overlayGradient = 'bg-gradient-to-b from-slate-950/90 via-blue-950/80 to-zinc-950/95';
          } else if (overlayStyle === 'emerald') {
            overlayGradient = 'bg-gradient-to-b from-emerald-950/85 via-teal-950/70 to-zinc-950/95';
          } else if (overlayStyle === 'rose') {
            overlayGradient = 'bg-gradient-to-b from-rose-950/85 via-purple-950/70 to-zinc-950/95';
          } else if (!settings?.hero?.darkenOverlay) {
            overlayGradient = 'bg-gradient-to-b from-black/70 via-black/50 to-zinc-950/80 sm:bg-white/50 sm:dark:bg-zinc-950/70';
          }

          return (
            <div
              className={`absolute inset-0 transition-all duration-500 backdrop-blur-[1px] ${overlayGradient}`}
            />
          );
        })()}

        {/* Ambient Floating Orbs / Particle Effect */}
        {settings?.hero?.showParticles !== false && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            <div className="absolute top-1/4 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-pink-500/10 rounded-full blur-3xl animate-pulse [animation-delay:3s]" />
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(168,85,247,0.25),rgba(0,0,0,0))]" />

        <div className="max-w-5xl mx-auto text-center relative z-10 px-2 sm:px-6 w-full">
          {(() => {
            const useGlassCard = settings?.hero?.useGlassBg !== false;
            const cardStyle = settings?.hero?.cardStyle || 'glass-xl';

            let cardBg = useGlassCard
              ? 'bg-zinc-950/70 sm:bg-white/85 dark:bg-zinc-950/85 border border-white/10 sm:border-white/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-2xl'
              : 'bg-transparent border-0 shadow-none';

            if (useGlassCard && cardStyle === 'cyber-neon') {
              cardBg = 'bg-zinc-950/85 border-2 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-2xl';
            } else if (useGlassCard && cardStyle === 'minimal-dark') {
              cardBg = 'bg-zinc-950/90 border border-zinc-800 shadow-xl backdrop-blur-md';
            } else if (useGlassCard && cardStyle === 'clean-border') {
              cardBg = 'bg-white/90 dark:bg-zinc-900/90 border-2 border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur-md';
            }

            const titleGradient = settings?.hero?.titleGradient || 'purple-pink';
            let gradientClass = 'from-purple-400 via-pink-400 to-indigo-300 sm:from-purple-600 sm:via-pink-500 sm:to-indigo-600 sm:dark:from-purple-400 sm:dark:via-pink-400 sm:dark:to-indigo-300';

            if (titleGradient === 'cyan-blue') {
              gradientClass = 'from-cyan-400 via-sky-400 to-indigo-300 sm:from-cyan-600 sm:via-sky-500 sm:to-indigo-600 sm:dark:from-cyan-400 sm:dark:via-sky-400 sm:dark:to-indigo-300';
            } else if (titleGradient === 'emerald-gold') {
              gradientClass = 'from-emerald-400 via-teal-400 to-amber-300 sm:from-emerald-600 sm:via-teal-500 sm:to-amber-500 sm:dark:from-emerald-400 sm:dark:via-teal-400 sm:dark:to-amber-300';
            } else if (titleGradient === 'sunset-orange') {
              gradientClass = 'from-rose-400 via-orange-400 to-amber-300 sm:from-rose-600 sm:via-orange-500 sm:to-amber-500 sm:dark:from-rose-400 sm:dark:via-orange-400 sm:dark:to-amber-300';
            } else if (titleGradient === 'neon-green') {
              gradientClass = 'from-lime-400 via-emerald-400 to-cyan-300 sm:from-lime-500 sm:via-emerald-500 sm:to-cyan-500 sm:dark:from-lime-400 sm:dark:via-emerald-400 sm:dark:to-cyan-300';
            }

            const primaryText = settings?.hero?.primaryCtaText || 'Book Court Now';
            const primaryLink = settings?.hero?.primaryCtaLink || '/booking';
            const secondaryText = settings?.hero?.secondaryCtaText || 'Explore Arena';
            const secondaryLink = settings?.hero?.secondaryCtaLink || '/about';

            return (
              <div className={`max-w-4xl mx-auto px-4 py-8 sm:p-10 md:p-14 rounded-3xl sm:rounded-[2.5rem] transition-all duration-300 ${cardBg}`}>
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeInUp}
                >
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] sm:text-xs font-extrabold mb-4 sm:mb-5 uppercase tracking-widest border border-purple-400/30 bg-purple-500/20 text-purple-300 sm:text-purple-650 sm:dark:text-purple-300 backdrop-blur-md shadow-xs">
                    {settings?.hero?.tagline || '⚡ Premium Indoor Court'}
                  </span>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 sm:mb-5 leading-[1.15] text-white sm:text-zinc-900 sm:dark:text-white drop-shadow-sm">
                    {settings?.hero?.title1 || 'Experience Sports'} <br />
                    <span className={`bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
                      {settings?.hero?.title2 || 'Like Never Before'}
                    </span>
                  </h1>
                  <p className="text-xs sm:text-base md:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed font-medium text-zinc-200 sm:text-zinc-700 sm:dark:text-zinc-300">
                    {settings?.hero?.description || 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.'}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full"
                >
                  <Link to={primaryLink} className="w-full sm:w-auto">
                    <Button size="large" variant="primary" className="w-full sm:w-auto px-8 py-3.5 text-sm sm:text-base font-extrabold shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 transition-all">
                      {primaryText} <ArrowRight className="w-5 h-5 ml-1.5" />
                    </Button>
                  </Link>
                  <Link to={secondaryLink} className="w-full sm:w-auto">
                    <Button
                      size="large"
                      variant="secondary"
                      className="w-full sm:w-auto px-8 py-3.5 text-sm sm:text-base font-extrabold bg-white/15 sm:bg-zinc-100 hover:bg-white/25 sm:hover:bg-zinc-200 text-white sm:text-zinc-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white border-white/20 sm:border-zinc-200/80 dark:border-white/20 backdrop-blur-md hover:scale-105 active:scale-95 transition-all"
                    >
                      {secondaryText}
                    </Button>
                  </Link>
                </motion.div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Real-time Status / Stats Counter */}
      <section className="relative z-20 -mt-8 max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-3xl glass-card shadow-xl border border-zinc-200/50 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80">
          <div className="flex flex-col items-center justify-center text-center p-3 border-r border-zinc-200/50 dark:border-zinc-800 last:border-0">
            <span className="text-2xl md:text-3xl font-black text-purple-650 dark:text-purple-400">
              {settings?.hero?.stats?.stat1Val || 'FIFA/FIBA'}
            </span>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
              {settings?.hero?.stats?.stat1Label || 'Standard Court'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3 border-r border-zinc-200/50 dark:border-zinc-800 last:border-0 md:border-r">
            <span className="text-2xl md:text-3xl font-black text-purple-650 dark:text-purple-400">
              {settings?.hero?.stats?.stat2Val || 'Roof'}
            </span>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
              {settings?.hero?.stats?.stat2Label || 'Weather Protected'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3 border-r border-zinc-200/50 dark:border-zinc-800 last:border-0">
            <span className="text-2xl md:text-3xl font-black text-purple-650 dark:text-purple-400">
              {settings?.hero?.stats?.stat3Val || 'Natural'}
            </span>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
              {settings?.hero?.stats?.stat3Label || 'Air Ventilation'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-3">
            <span className="text-2xl md:text-3xl font-black text-purple-650 dark:text-purple-400">
              {settings?.hero?.stats?.stat4Val || '24/7'}
            </span>
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
              {settings?.hero?.stats?.stat4Label || 'CCTV & Security'}
            </span>
          </div>
        </div>
      </section>

      {/* Available Sports Section */}
      {sports.length > 1 && (
        <section className="py-24 px-4 max-w-7xl mx-auto text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-purple-500/5 dark:bg-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-purple-650 dark:text-purple-400 mb-3 bg-purple-105 dark:bg-purple-950/40 px-3.5 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5" /> Core Arena
            </span>
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-zinc-900 dark:text-white">
              Choose Your Arena
            </h2>
            <p className="text-zinc-550 dark:text-zinc-400 mb-16 max-w-md mx-auto text-sm leading-relaxed">
              Switch styles and play your favorite game. Our premium hardwood surface is fully optimized for top-level performance.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {sports.map((sport) => {
              const colorClass = getSportColorClass(sport);
              return (
                <motion.div
                  key={sport}
                  variants={fadeInUp}
                  whileHover={{ y: -10, scale: 1.03 }}
                  className="group relative p-8 rounded-3xl glass-card border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-900 shadow-sm transition-all duration-300 flex flex-col items-center justify-center gap-5 cursor-pointer"
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner border border-transparent transition-all duration-300 ${colorClass}`}>
                    {getSportIcon(sport)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-extrabold text-xl text-zinc-800 dark:text-zinc-100">{sport}</span>
                    <span className="text-[11px] text-zinc-450 uppercase tracking-widest font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Book Court &rarr;</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* Dynamic Pricing Calculator Section */}
      <section className="py-24 bg-zinc-100/40 dark:bg-zinc-950/30 border-y border-zinc-200/40 dark:border-zinc-900/60 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-6 space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" /> Fair & Transparent
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white leading-tight">
              Interactive Pricing & Shifts
            </h2>
            <p className="text-zinc-550 dark:text-zinc-400 leading-relaxed text-sm">
              We adjust rates based on shifts and scheduling peaks (Weekdays, Weekends, and Holidays) to bring you the best value. Use this calculator widget to preview court costs.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
              <div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Day Shift</span>
                <p className="text-sm font-extrabold mt-1 text-zinc-700 dark:text-zinc-350">{settings?.businessHours?.dayShift || '06:00 AM - 04:00 PM'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Night Shift</span>
                <p className="text-sm font-extrabold mt-1 text-zinc-700 dark:text-zinc-350">{settings?.businessHours?.nightShift || '04:00 PM - 02:00 AM'}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Session Slots</span>
                <p className="text-sm font-extrabold mt-1 text-zinc-700 dark:text-zinc-350">1 Hour Intervals</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="p-6 md:p-8 rounded-[2rem] glass-card border border-zinc-200/60 dark:border-zinc-850 bg-white/80 dark:bg-zinc-900/80 shadow-2xl space-y-6">
              <h3 className="text-xl font-bold text-center text-zinc-850 dark:text-zinc-100 flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-650" /> Rate Previewer
              </h3>

              {/* Day Type Toggle */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Day Type</label>
                <div className="grid grid-cols-3 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {['weekday', 'weekend', 'holiday'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCalcDayType(t)}
                      className={`py-2 text-xs font-extrabold rounded-lg capitalize transition-all ${calcDayType === t
                          ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shift Selector */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Shift</label>
                <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {['day', 'night'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCalcShift(s)}
                      className={`py-2 text-xs font-extrabold rounded-lg capitalize transition-all ${calcShift === s
                          ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                    >
                      {s} Shift
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Output Display Card */}
              <div className="p-5 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/15 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-purple-600 dark:text-purple-400">ESTIMATED RATE</span>
                  <div className="text-xs text-zinc-450 dark:text-zinc-500 mt-0.5">Per 1-Hour Session</div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-purple-650 dark:text-purple-400">৳{getCalculatedPrice()}</span>
                </div>
              </div>

              <Link to="/booking" className="block">
                <Button variant="primary" className="w-full py-3.5 font-bold shadow-md shadow-purple-500/10">
                  Go To Live Calendar <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Facilities Showcase Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-purple-650 dark:text-purple-400 mb-3 bg-purple-100 dark:bg-purple-950/40 px-3.5 py-1 rounded-full">
            <Award className="w-3.5 h-3.5" /> High Standards
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-4">
            Designed For Athletes
          </h2>
          <p className="text-zinc-550 dark:text-zinc-450 max-w-md mx-auto text-sm leading-relaxed">
            Every square inch of our arena represents premium quality designed for ultimate play.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feat, idx) => (
            <motion.div
              key={feat.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { delay: idx * 0.1, duration: 0.5 } }
              }}
              className="p-6 rounded-3xl glass-card border border-zinc-200/50 dark:border-zinc-800/80 hover-glow shadow-sm flex flex-col gap-4 text-left hover:bg-white dark:hover:bg-zinc-900/60"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shadow-inner">
                {feat.icon}
              </div>
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white leading-snug">{feat.title}</h3>
              <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed font-medium">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {reviews && (
        <section className="py-24 bg-zinc-100/40 dark:bg-zinc-950/20 border-t border-zinc-200/40 dark:border-zinc-900/60 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 max-w-2xl mx-auto flex flex-col items-center gap-4">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Star className="w-3.5 h-3.5 animate-pulse" /> Player Love
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white">
                What Our Community Says
              </h2>
              <p className="text-zinc-550 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-md">
                Hear from futsal players, cricketers, and families who play at our arena every day.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setReviewModalOpen(true)}
                  className="font-bold border-purple-500/20 text-purple-650 hover:bg-purple-500/5 dark:text-purple-400 rounded-2xl px-6 py-2.5 shadow-sm"
                >
                  Write a Review <Sparkles className="w-4 h-4 ml-2 text-purple-500" />
                </Button>
              </div>
            </div>

            {reviews.filter(r => r.isFeatured).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {reviews.filter(r => r.isFeatured).map((rev) => (
                  <motion.div
                    key={rev._id || rev.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="glass-card hover-glow rounded-3xl p-6 shadow-sm text-left flex flex-col justify-between hover:bg-white dark:hover:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800"
                  >
                    <div>
                      <div className="flex items-center gap-0.5 mb-4">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm text-zinc-650 dark:text-zinc-350 italic mb-6 leading-relaxed">
                        "{rev.comment}"
                      </p>
                    </div>
                    <div className="font-extrabold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 mt-2">
                      &mdash; {rev.customerName}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-12 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-550">
                No featured reviews yet. Be the first to share your experience!
              </div>
            )}
          </div>

          {/* Write a Review Modal */}
          {reviewModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800 p-8 w-full max-w-lg shadow-2xl relative"
              >
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-650 dark:hover:text-white text-xl font-bold p-2"
                >
                  &times;
                </button>
                <div className="mb-6">
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Share Your Feedback</h3>
                  <p className="text-zinc-500 text-xs mt-1">Your review will be posted once approved by the administrators.</p>
                </div>

                {submitSuccess ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <h4 className="text-lg font-bold text-zinc-900 dark:text-white">Review Submitted!</h4>
                    <p className="text-sm text-zinc-550 dark:text-zinc-450">Thank you for sharing your experience with us.</p>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit} className="space-y-5 text-left">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Your Name</label>
                      <input
                        type="text"
                        required
                        placeholder="ADIL HUSSAIN"
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-zinc-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Rating</label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-7 h-7 ${
                                star <= reviewRating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-zinc-300 dark:text-zinc-700'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Your Message</label>
                      <textarea
                        required
                        rows="4"
                        placeholder="Tell us about the court quality, amenities, or booking experience..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-zinc-800 dark:text-white"
                      />
                    </div>

                    {submitError && (
                      <p className="text-xs font-semibold text-red-500 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                        {submitError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full py-3 font-bold"
                      disabled={createReviewMutation.isPending}
                    >
                      {createReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </section>
      )}

      {/* Google Maps / Contact CTA */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          <div className="text-left space-y-8">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <MapPin className="w-3.5 h-3.5" /> Location & Contact
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white">
                Find Our Arena
              </h2>
              <p className="text-zinc-550 dark:text-zinc-400 leading-relaxed text-sm">
                We are situated at a prime urban hub with ample parking, dedicated showers, and refreshments. Stop by or book a slot online instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-200/50 dark:border-zinc-800">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest">Address</h4>
                  <p className="text-zinc-850 dark:text-zinc-200 text-sm font-semibold mt-0.5">{settings?.contactAddress}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest">Hours</h4>
                  <p className="text-zinc-850 dark:text-zinc-200 text-sm font-semibold mt-0.5">
                    Weekdays: {settings?.businessHours?.weekday} <br />
                    Weekends: {settings?.businessHours?.weekend}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative p-2 rounded-[2.5rem] border border-white/20 dark:border-white/10 bg-white/5 dark:bg-zinc-950/20 backdrop-blur-xl shadow-2xl transition-all duration-300">
            <div className="relative h-96 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group">
              {/* Liquid Gloss/Shine Sweep Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.2s] ease-out pointer-events-none z-20" />

              {/* Inner Shadow Overlay */}
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_40px_rgba(0,0,0,0.4)] rounded-[2rem] z-10" />

              {/* Top-Left: Open in Maps button */}
              <a
                href={settings?.googleMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 left-4 z-25 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-lg hover:bg-purple-650 hover:text-white dark:hover:bg-purple-650 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Open in Maps
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {/* Bottom-Left: Address Indicator */}
              <div className="absolute bottom-4 left-4 z-25 bg-zinc-950/80 dark:bg-zinc-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-white text-xs font-bold shadow-xl flex items-center gap-2 max-w-[85%] sm:max-w-md select-none transition-all hover:bg-black">
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

        </div>
      </section>

    </div>
  );
};
