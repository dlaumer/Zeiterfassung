import { ArrowRight, ExternalLink, FileText, LockKeyhole, Mail, Newspaper } from 'lucide-react';
import { I18nProvider, useI18n } from './i18n/i18n';
import { LanguageSelector } from './i18n/LanguageSelector';
import stukoSlidesUrl from '../assets/Beilage-04_StuKo_2026-05-07_D-BAUG-Workload-Monitoring.pdf';
import logoMethric from '../assets/logoMethric.png';

const contactEmail = 'katharina.sperger@stab.baug.ethz.ch';
const innovedumProjectUrl =
  'https://innovedumprojects.ethz.ch/projects/enhancing-teaching-with-active-learning-workload-flexibility-with-increased-enjoyment/';

function LandingPageContent() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-[#f7faf9] text-slate-950">
      <section className="relative flex min-h-[68vh] flex-col px-5 py-6 sm:px-8 lg:px-12">
        <div className="z-10 mb-8 flex w-full justify-end gap-2 md:absolute md:right-8 md:top-6 md:mb-0 md:w-auto lg:right-12">
          <LanguageSelector />
          <a
            href="/admin"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:px-4"
          >
            <LockKeyhole className="h-4 w-4" />
            {t('landing.adminLogin')}
          </a>
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
          <img
            src={logoMethric}
            alt="mETHric"
            className="h-auto w-full max-w-[20rem] object-contain sm:max-w-[34rem] md:max-w-[680px]"
          />

          <div className="mt-8 max-w-3xl sm:mt-9">
            <p className="text-base font-semibold uppercase tracking-[0.12em] text-sky-800 sm:text-lg sm:tracking-[0.14em]">
              {t('landing.eyebrow')}
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              {t('landing.title')}
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-700 sm:text-lg">
              {t('landing.description')}
            </p>
          </div>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              <Mail className="h-5 w-5" />
              {t('landing.contactCta')}
            </a>
            <a
              href="#news"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition-colors hover:border-emerald-400 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {t('landing.newsCta')}
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] md:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">{t('landing.contactTitle')}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
              {t('landing.contactDescription')}
            </p>
          </div>
          <a
            href={`mailto:${contactEmail}`}
            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
          >
            <Mail className="mt-1 h-5 w-5 shrink-0 text-sky-700" />
            <span className="min-w-0">
              <span className="block font-semibold text-slate-950">Katharina Sperger</span>
              <span className="block break-all text-sm font-medium text-sky-800">{contactEmail}</span>
            </span>
          </a>
        </div>
      </section>

      <section id="news" className="px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-emerald-700" />
            <h2 className="text-2xl font-semibold text-slate-950">{t('landing.newsTitle')}</h2>
          </div>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">
              {t('landing.newsStuKoDate')}
            </p>
            <p className="mt-3 text-base leading-7 text-slate-800">
              {t('landing.newsStuKoText')}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={stukoSlidesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition-colors hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <FileText className="h-4 w-4" />
                {t('landing.newsSlidesLink')}
              </a>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {t('landing.newsInnovedumText')}{' '}
              <a
                href={innovedumProjectUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900"
              >
                {innovedumProjectUrl}
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LandingPage() {
  return (
    <I18nProvider>
      <LandingPageContent />
    </I18nProvider>
  );
}
