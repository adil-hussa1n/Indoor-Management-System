import { DataTypes } from 'sequelize';
import { sequelize } from '../config/sequelize.js';

const Settings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  logo: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  heroBanner: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  hero: {
    type: DataTypes.JSON,
    defaultValue: {
      tagline: '⚡ Premium Indoor Court',
      title1: 'Experience Sports',
      title2: 'Like Never Before',
      description: 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.',
      mediaType: 'image',
      autoPlay360: true,
      useGlassBg: false,
      darkenOverlay: false,
      blurBackground: false,
      zoomAnimation: false,
    },
  },
  businessName: {
    type: DataTypes.STRING,
    defaultValue: 'Apex Indoor Sports Arena',
  },
  contactEmail: {
    type: DataTypes.STRING,
    defaultValue: 'info@apexindoorsports.com',
  },
  contactPhone: {
    type: DataTypes.STRING,
    defaultValue: '+880 1712-345678',
  },
  contactAddress: {
    type: DataTypes.STRING,
    defaultValue: 'Sector 11, Uttara, Dhaka, Bangladesh',
  },
  businessHours: {
    type: DataTypes.JSON,
    defaultValue: {
      weekday: '08:00 - 22:00',
      weekend: '09:00 - 23:00',
    },
  },
  pricing: {
    type: DataTypes.JSON,
    defaultValue: {
      weekdayDay: 1200,
      weekdayNight: 1400,
      weekendDay: 1700,
      weekendNight: 1800,
      holidayDay: 2000,
      holidayNight: 2200,
    },
  },
  weekendDays: {
    type: DataTypes.JSON,
    defaultValue: [5], // Friday is weekend by default in Bangladesh
  },
  socialLinks: {
    type: DataTypes.JSON,
    defaultValue: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com',
      whatsapp: 'https://wa.me/15551234567',
    },
  },
  seo: {
    type: DataTypes.JSON,
    defaultValue: {
      title: 'Apex Indoor Sports Booking',
      description: 'Book the premium indoor playground for your favorite sports.',
      keywords: 'sports, indoor, booking, arena, basketball, soccer',
    },
  },
  googleMapUrl: {
    type: DataTypes.TEXT,
    defaultValue: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3350.53696803273!2d-96.80415392348507!3d32.784651373660596!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864e9921e1e07567%3A0xc3cf9c9bfd4db459!2sDallas%20Downtown!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus',
  },
  holidays: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  maintenanceDays: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  availableSports: {
    type: DataTypes.JSON,
    defaultValue: ['Football'],
  },
  theme: {
    type: DataTypes.STRING,
    defaultValue: 'default',
  },
  enableDarkMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  rules: {
    type: DataTypes.JSON,
    defaultValue: [
      'Only non-marking athletic shoes are allowed on the court playing surface.',
      'Bookings are strict. Please vacate the court immediately when your session ends.',
      'No food or sugary beverages on the main hardwood floor (bottled water only).',
      'Proper sports attire must be worn at all times.',
      'D-Box Indoor is not responsible for any lost or stolen personal belongings.',
      'Damaging facilities or equipment will result in replacement fines.'
    ],
  },
}, {
  tableName: 'settings',
  timestamps: true,
  version: true, // Optimistic locking enabled
});

export default Settings;
