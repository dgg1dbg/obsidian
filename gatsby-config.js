module.exports = {
  plugins: [
    {
      resolve: `gatsby-theme-garden`,
      options: {
        contentPath: `${__dirname}/src/site/notes`,
        rootNote: `/test`,
      },
    },
    `gatsby-plugin-netlify`
  ],
  siteMetadata: {
    title: process.env.SITE_NAME,
  },
}
