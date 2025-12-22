import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

const exampleCode = `import { MCPServer, Tool, Param, listen, bootstrap } from '@mcpkit-dev/core';
import { z } from 'zod';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Add two numbers' })
  add(
    @Param({ schema: z.number() }) a: number,
    @Param({ schema: z.number() }) b: number
  ) {
    return { result: a + b };
  }
}

listen(bootstrap(MyServer));`;

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.badge}>
          <svg className={styles.badgeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Open Source MCP Framework
        </div>

        <h1 className={styles.title}>
          Build MCP servers<br />
          with TypeScript decorators
        </h1>

        <p className={styles.description}>
          A modern, type-safe toolkit for building production-ready Model Context Protocol servers.
          Define tools, resources, and prompts with clean decorator syntax.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primaryBtn} to="/docs/intro">
            Get Started
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link className={styles.secondaryBtn} to="https://github.com/v-checha/mcpkit">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </Link>
        </div>

        <div className={styles.codePreview}>
          <div className={styles.codeHeader}>
            <div className={styles.codeTab}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14,2 14,8 20,8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              server.ts
            </div>
          </div>
          <CodeBlock language="typescript">{exampleCode}</CodeBlock>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Decorator-Based',
    description: 'Define tools, resources, and prompts using clean TypeScript decorators.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Type-Safe',
    description: 'Full TypeScript support with Zod schema validation at runtime.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Production Ready',
    description: 'Built-in middleware, auth, rate limiting, metrics, and tracing.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Multiple Transports',
    description: 'Support for stdio, HTTP, SSE, and Streamable HTTP protocols.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Plugin System',
    description: 'Extend with plugins for metrics, health checks, CORS, and more.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Testing Utilities',
    description: 'Mock clients and servers for comprehensive testing.',
  },
];

function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.featuresHeader}>
          <h2 className={styles.featuresTitle}>Everything you need</h2>
          <p className={styles.featuresDescription}>
            MCPKit provides a complete toolkit for building, testing, and deploying MCP servers.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <div key={idx} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Install() {
  return (
    <section className={styles.install}>
      <div className={styles.container}>
        <div className={styles.installHeader}>
          <h2 className={styles.installTitle}>Quick Start</h2>
          <p className={styles.installDescription}>Get started in seconds with the CLI.</p>
        </div>

        <div className={styles.installSteps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>Create a new project</p>
              <div className={styles.stepCode}>
                <code>npx @mcpkit-dev/cli init my-server</code>
                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText('npx @mcpkit-dev/cli init my-server')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>Start development server</p>
              <div className={styles.stepCode}>
                <code>cd my-server && npm run dev</code>
                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText('cd my-server && npm run dev')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>Connect your AI client</p>
              <p className={styles.stepNote}>Works with Claude Desktop, VS Code, and any MCP client.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to get started?</h2>
          <p className={styles.ctaDescription}>
            Build your first MCP server in minutes.
          </p>
          <Link className={styles.ctaBtn} to="/docs/intro">
            Read the docs
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Modern MCP Server Framework"
      description="Build production-ready MCP servers with TypeScript decorators. Type-safe, extensible, and easy to use.">
      <main>
        <Hero />
        <Features />
        <Install />
        <CTA />
      </main>
    </Layout>
  );
}
