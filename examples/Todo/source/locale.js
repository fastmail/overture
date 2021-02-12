import { addLocale, Locale, setLocale } from 'overture/localisation';
import data from 'strings/en/en.po';

const locale = new Locale(data);
addLocale(locale);
setLocale(data.code);
