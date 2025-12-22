import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'MCPKit',
  tagline: 'Developer-friendly toolkit for building MCP servers',
  favicon: 'img/logo.svg',

  url: 'https://mcpkit-dev.github.io',
  baseUrl: '/mcpkit/',

  organizationName: 'mcpkit-dev',
  projectName: 'mcpkit',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/mcpkit-dev/mcpkit/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    navbar: {
      title: 'MCPKit',
      logo: {
        alt: 'MCPKit Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/mcpkit-dev/mcpkit',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@mcpkit-dev/core',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Guides',
              to: '/docs/guides/tools',
            },
            {
              label: 'API Reference',
              to: '/docs/api/decorators',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/mcpkit-dev/mcpkit',
            },
            {
              label: 'Issues',
              href: 'https://github.com/mcpkit-dev/mcpkit/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@mcpkit-dev/core',
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} MCPKit. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json'],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
