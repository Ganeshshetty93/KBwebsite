import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Edit3,
  Eye,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  Images,
  Mail,
  Megaphone,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react';

const iconRules = [
  [/sponsor|partner/i, Sparkles],
  [/allotment|teacher/i, GraduationCap],
  [/role|permission|access/i, ShieldCheck],
  [/registration|register/i, ClipboardCheck],
  [/event|calendar/i, CalendarDays],
  [/class|course|program/i, BookOpen],
  [/announcement/i, Megaphone],
  [/fundrais|donation/i, HandCoins],
  [/payment/i, CreditCard],
  [/expense|receipt/i, ReceiptText],
  [/volunteer/i, HeartHandshake],
  [/contact|message|email/i, Mail],
  [/user|member|profile|account/i, UserRound],
  [/gallery|image|photo/i, Images],
  [/detail/i, Eye],
  [/success|confirmed|complete|submitted/i, CheckCircle2],
  [/edit|update/i, Edit3],
  [/add|create|new/i, Plus]
];

function getTitleIcon(value) {
  const title = String(value || '').trim();
  return iconRules.find(([pattern]) => pattern.test(title))?.[1] || null;
}

export default function ModalTitle({ children, className = '', matchText = '' }) {
  const Icon = getTitleIcon(matchText || children);
  const classes = ['modal-title', Icon ? 'has-icon' : 'is-text-only', className].filter(Boolean).join(' ');

  return (
    <h2 className={classes}>
      {Icon && <i className="modal-title-icon" aria-hidden="true"><Icon size={20} strokeWidth={2.2} /></i>}
      {children}
    </h2>
  );
}
