import { type ReactNode } from 'react';
import {
  Building2,
  Globe,
  Headphones,
  Mail,
  MapPin,
  Phone,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { APP_NAME, APP_TAGLINE, APP_VERSION, COMPANY } from '../constants/branding';

function ContactCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col items-center text-center gap-2 mb-3">
        <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <h2 className="text-sm font-bold text-slate-900 m-0">{title}</h2>
      </div>
      <div className="space-y-2.5 text-sm text-slate-600 text-center flex flex-col items-center">
        {children}
      </div>
    </section>
  );
}

function LinkRow({
  href,
  children,
  mono = false,
}: {
  href: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 hover:underline font-medium ${
        mono ? 'font-mono text-[13px]' : ''
      }`}
    >
      {children}
      <ExternalLink size={12} className="opacity-60" />
    </a>
  );
}

function EmpresaBlock({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2.5 px-3 py-2">
      <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
        {icon}
      </span>
      <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="text-sm text-slate-700 leading-snug">{children}</div>
    </div>
  );
}

export default function HelpView() {
  return (
    <div className="h-full overflow-y-auto bg-[#f1f5f9]">
      <div className="min-h-full flex items-center justify-center px-5 md:px-8 py-6 md:py-8">
        <div className="w-full max-w-3xl space-y-5">
        <header className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-6 flex flex-col items-center text-center gap-4">
            <img
              src={`${import.meta.env.BASE_URL}tangoid.png`}
              alt={COMPANY.brand}
              width={72}
              height={72}
              className="object-contain"
              draggable={false}
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900 m-0 tracking-tight">{APP_NAME}</h1>
              <p className="text-sm text-slate-500 m-0 mt-1">{APP_TAGLINE}</p>
              <p className="text-xs text-slate-400 m-0 mt-2 font-mono">Versión {APP_VERSION}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ContactCard icon={<Briefcase size={18} />} title={COMPANY.commercial.label}>
            <p className="m-0 text-slate-500 text-[13px] leading-snug max-w-xs">
              {COMPANY.commercial.hint}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <LinkRow href={`mailto:${COMPANY.commercial.email}`} mono>
                {COMPANY.commercial.email}
              </LinkRow>
            </div>
          </ContactCard>

          <ContactCard icon={<Headphones size={18} />} title={COMPANY.support.label}>
            <p className="m-0 text-slate-500 text-[13px] leading-snug max-w-xs">
              {COMPANY.support.hint}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <LinkRow href={`mailto:${COMPANY.support.email}`} mono>
                {COMPANY.support.email}
              </LinkRow>
            </div>
          </ContactCard>
        </div>

        <ContactCard icon={<Building2 size={18} />} title="Empresa">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-2 sm:divide-x sm:divide-slate-100 pt-1">
            <EmpresaBlock icon={<MapPin size={18} />} label="Dirección">
              <div className="space-y-0.5">
                {COMPANY.addressLines.map((line) => (
                  <p key={line} className="m-0">
                    {line}
                  </p>
                ))}
              </div>
            </EmpresaBlock>

            <EmpresaBlock icon={<Phone size={18} />} label="Teléfonos">
              <div className="space-y-2">
                {COMPANY.phones.map((phone) => (
                  <div key={phone.tel}>
                    <p className="m-0 text-[11px] text-slate-400 font-medium">{phone.label}</p>
                    <LinkRow href={`tel:${phone.tel}`}>{phone.value}</LinkRow>
                  </div>
                ))}
              </div>
            </EmpresaBlock>

            <EmpresaBlock icon={<Globe size={18} />} label="Sitio web">
              <LinkRow href={COMPANY.website}>{COMPANY.websiteLabel}</LinkRow>
            </EmpresaBlock>
          </div>
        </ContactCard>

        <footer className="text-center px-4 py-5 space-y-1.5">
          <p className="m-0 text-xs text-slate-500 leading-relaxed">
            © {COMPANY.copyrightYear} {COMPANY.legalName}. Todos los derechos reservados.
          </p>
          <p className="m-0 text-[11px] text-slate-400 leading-relaxed max-w-xl mx-auto">
            {APP_NAME} es un producto de software desarrollado e implementado por {COMPANY.legalName}.
            Las marcas mencionadas pertenecen a sus respectivos titulares.
          </p>
          <p className="m-0 text-[11px] text-slate-400 font-mono pt-1">
            {APP_NAME} v{APP_VERSION}
          </p>
        </footer>
        </div>
      </div>
    </div>
  );
}
