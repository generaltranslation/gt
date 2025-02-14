// hidden internal route
export default {
  getLocale: () => {
    throw new Error(
      `Unable to import custom getLocale(). Check docs.generaltranslation.com for the latest documentation.`
    );
  }
};
