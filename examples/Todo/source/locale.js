import { addLocale, Locale, setLocale } from '/overture/localisation';


// ---

const locale = new Locale({
    "code": "en",
    "decimalPoint": ".",
    "thousandsSeparator": ",",
    "fileSizeUnits": [
        "B",
        "KB",
        "MB",
        "GB"
    ],
    "dayNames": [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ],
    "abbreviatedDayNames": [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ],
    "monthNames": [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ],
    "abbreviatedMonthNames": [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ],
    "amDesignator": "AM",
    "pmDesignator": "PM",
    "use24hClock": false,
    "dateElementOrder": "mdy",
    "dateFormats": {
        "date": "%m/%d/%Y",
        "time12": "%-I:%M %p",
        "time24": "%H:%M",
        "fullDate": "%A, %B %d, %Y",
        "fullDateAndTime": "%A, %B %d, %Y %X",
        "abbreviatedFullDate": "%a, %b %d, %Y",
        "shortDayMonth": "%b %-d",
        "shortDayMonthYear": "%b %-d, %Y",
        "shortDayDate": "%a, %b %-d, %Y",
        "shortMonthYear": "%b %Y"
    },
    "datePatterns": {
        "jan": {},
        "feb": {},
        "mar": {},
        "apr": {},
        "may": {},
        "jun": {},
        "jul": {},
        "aug": {},
        "sep": {},
        "oct": {},
        "nov": {},
        "dec": {},
        "mon": {},
        "tue": {},
        "wed": {},
        "thu": {},
        "fri": {},
        "sat": {},
        "sun": {},
        "past": {},
        "future": {},
        "add": {},
        "subtract": {},
        "yesterday": {},
        "today": {},
        "tomorrow": {},
        "now": {},
        "am": {},
        "pm": {},
        "ordinalSuffix": {},
        "timeContext": {}
    },
    "translations": {}
});
addLocale(locale);
setLocale('en');
