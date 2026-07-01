import React from 'react';
import { ShieldCheck, CalendarCheck, Clock, MapPin, Sparkles } from 'lucide-react';
import { usePublicSettings } from '../hooks/useApi';

export const About = () => {
  const { data: settings } = usePublicSettings();

  const rules = [
    'Only non-marking athletic shoes are allowed on the court playing surface.',
    'Bookings are strict. Please vacate the court immediately when your session ends.',
    'No food or sugary beverages on the main hardwood floor (bottled water only).',
    'Proper sports attire must be worn at all times.',
    'Apex Arena is not responsible for any lost or stolen personal belongings.',
    'Damaging facilities or equipment will result in replacement fines.',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-left">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6 text-center">
        About <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Apex Arena</span>
      </h1>
      
      <p className="text-lg text-zinc-650 dark:text-zinc-400 mb-12 text-center max-w-2xl mx-auto leading-relaxed">
        We provide the premier indoor playground facility in the city. A single court engineered for high-intensity games, friendly match-ups, and professional training.
      </p>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-8 rounded-2xl shadow-sm">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" /> Our Mission
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            To deliver an elite, climate-controlled arena where sports enthusiasts can hone their skills and enjoy matches without worrying about weather conditions. We maintain absolute cleanliness, premium flooring, and a seamless slot locking booking interface.
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800/80 p-8 rounded-2xl shadow-sm">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> Facilities
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Our arena features professional shocks-absorbing hardwood, stadium-grade LED illumination, changing lockboxes, and guest seating. Fully customizable markings support futsal goals, basketball hoops, and net setups.
          </p>
        </div>
      </div>

      {/* Business Hours & Rules */}
      <div className="border-t border-zinc-200/50 dark:border-zinc-900 pt-12 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2">
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            Rules & Regulations
          </h3>
          <ul className="space-y-4">
            {rules.map((rule, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-purple-500/10 flex-shrink-0 flex items-center justify-center text-purple-650 font-bold text-xs">
                  {idx + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" /> Operating Hours
            </h3>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-455">
              <div className="flex justify-between">
                <span>Weekdays:</span>
                <span className="font-semibold">{settings?.businessHours?.weekday}</span>
              </div>
              <div className="flex justify-between">
                <span>Weekends:</span>
                <span className="font-semibold">{settings?.businessHours?.weekend}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-500" /> Location
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {settings?.contactAddress}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
