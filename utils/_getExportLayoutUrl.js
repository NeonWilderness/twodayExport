/**
 * Get the exportLayoutUrl of a Twoday blog with admin access auth
 * ===============================================================
 * 
 */

/**
 * Read the layouts main page and return the export layout url
 * @param blog string name of the twoday blog with admin access
 * @returns string url of the blog's export layout
 */
const getExportLayoutUrl = blog => {
  return `https://${blog}.twoday.net/layouts/export/`;
};

module.exports = getExportLayoutUrl;