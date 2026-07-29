declare module 'xdate' {
  type LocaleDefinition = {
    dayNames: string[];
    dayNamesShort: string[];
    monthNames: string[];
    monthNamesShort: string[];
    today: string;
  };

  const XDate: {
    defaultLocale: string;
    locales: Record<string, LocaleDefinition>;
  };

  export default XDate;
}
