/**
 * Stripe Infrastructure as Code (IaC) Setup Script
 *
 * This script creates and configures all Stripe products, prices, and billing settings
 * for the Nuclom video collaboration platform.
 *
 * Pricing Configuration:
 * - Monthly: $25/user/month (refundable with prorated daily usage)
 * - Yearly: $19/user/month ($228/year, 24% savings, non-refundable)
 * - Trial: 14 days (no credit card required)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... npx tsx scripts/setup-stripe.ts
 *
 * Options:
 *   --dry-run    Preview changes without creating resources
 *   --force      Update existing resources instead of skipping
 */

import Stripe from "stripe";

// =============================================================================
// Configuration
// =============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("Error: STRIPE_SECRET_KEY environment variable is required");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE_UPDATE = args.includes("--force");

// =============================================================================
// Product & Price Definitions
// =============================================================================

interface PriceConfig {
  nickname: string;
  unit_amount: number; // in cents
  recurring: {
    interval: "month" | "year";
    interval_count: number;
  };
  metadata: Record<string, string>;
}

interface ProductConfig {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: PriceConfig[];
}

const PRODUCTS: ProductConfig[] = [
  {
    id: "prod_nuclom_pro",
    name: "Nuclom Pro",
    description:
      "Video collaboration platform with AI-powered features, transcription, and team collaboration tools.",
    metadata: {
      plan_type: "pro",
      trial_days: "14",
      features: "ai_insights,transcription,collaboration,integrations",
    },
    prices: [
      {
        nickname: "Pro Monthly",
        unit_amount: 2500, // $25.00
        recurring: {
          interval: "month",
          interval_count: 1,
        },
        metadata: {
          billing_period: "monthly",
          refund_policy: "prorated_daily",
          price_per_user: "25.00",
        },
      },
      {
        nickname: "Pro Yearly",
        unit_amount: 22800, // $228.00/year = $19/month
        recurring: {
          interval: "year",
          interval_count: 1,
        },
        metadata: {
          billing_period: "yearly",
          refund_policy: "non_refundable",
          price_per_user: "19.00",
          yearly_savings: "24%",
        },
      },
    ],
  },
  {
    id: "prod_nuclom_enterprise",
    name: "Nuclom Enterprise",
    description:
      "Enterprise video collaboration with unlimited storage, SSO integration, advanced AI, and dedicated support.",
    metadata: {
      plan_type: "enterprise",
      trial_days: "14",
      features: "unlimited_storage,sso,advanced_ai,dedicated_support,custom_branding,api_access",
    },
    prices: [
      {
        nickname: "Enterprise Monthly",
        unit_amount: 9900, // $99.00
        recurring: {
          interval: "month",
          interval_count: 1,
        },
        metadata: {
          billing_period: "monthly",
          refund_policy: "prorated_daily",
          price_per_user: "99.00",
        },
      },
      {
        nickname: "Enterprise Yearly",
        unit_amount: 99000, // $990.00/year = ~$82.50/month
        recurring: {
          interval: "year",
          interval_count: 1,
        },
        metadata: {
          billing_period: "yearly",
          refund_policy: "non_refundable",
          price_per_user: "82.50",
          yearly_savings: "17%",
        },
      },
    ],
  },
];

// Billing Portal Configuration
const BILLING_PORTAL_CONFIG: Stripe.BillingPortal.ConfigurationCreateParams = {
  business_profile: {
    headline: "Nuclom - Manage your subscription",
    privacy_policy_url: "https://nuclom.com/privacy",
    terms_of_service_url: "https://nuclom.com/terms",
  },
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ["email", "name", "address", "phone"],
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
    },
  },
  default_return_url: "https://nuclom.com/settings/billing",
};

// =============================================================================
// Helper Functions
// =============================================================================

async function findExistingProduct(productId: string): Promise<Stripe.Product | null> {
  try {
    const products = await stripe.products.list({ limit: 100 });
    return products.data.find((p) => p.metadata.product_id === productId) || null;
  } catch {
    return null;
  }
}

async function findExistingPrice(
  productId: string,
  interval: string,
): Promise<Stripe.Price | null> {
  try {
    const prices = await stripe.prices.list({
      limit: 100,
      active: true,
    });
    return (
      prices.data.find(
        (p) =>
          typeof p.product === "string" &&
          p.metadata.billing_period === interval &&
          p.metadata.product_id === productId,
      ) || null
    );
  } catch {
    return null;
  }
}

function log(message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅",
    warning: "⚠️ ",
    error: "❌",
  };
  console.log(`${prefix[type]} ${message}`);
}

// =============================================================================
// Setup Functions
// =============================================================================

async function createProduct(config: ProductConfig): Promise<Stripe.Product> {
  const existingProduct = await findExistingProduct(config.id);

  if (existingProduct && !FORCE_UPDATE) {
    log(`Product "${config.name}" already exists (${existingProduct.id}), skipping...`, "warning");
    return existingProduct;
  }

  if (DRY_RUN) {
    log(`[DRY RUN] Would create product: ${config.name}`, "info");
    return { id: "dry_run_product_id" } as Stripe.Product;
  }

  if (existingProduct && FORCE_UPDATE) {
    log(`Updating existing product "${config.name}"...`, "info");
    const updated = await stripe.products.update(existingProduct.id, {
      name: config.name,
      description: config.description,
      metadata: {
        ...config.metadata,
        product_id: config.id,
      },
    });
    log(`Updated product: ${updated.id}`, "success");
    return updated;
  }

  log(`Creating product: ${config.name}...`, "info");
  const product = await stripe.products.create({
    name: config.name,
    description: config.description,
    metadata: {
      ...config.metadata,
      product_id: config.id,
    },
  });
  log(`Created product: ${product.id}`, "success");
  return product;
}

async function createPrice(
  productId: string,
  config: PriceConfig,
  productConfigId: string,
): Promise<Stripe.Price> {
  const billingPeriod = config.metadata.billing_period;
  const existingPrice = await findExistingPrice(productConfigId, billingPeriod);

  if (existingPrice && !FORCE_UPDATE) {
    log(`Price "${config.nickname}" already exists (${existingPrice.id}), skipping...`, "warning");
    return existingPrice;
  }

  if (DRY_RUN) {
    log(
      `[DRY RUN] Would create price: ${config.nickname} - $${(config.unit_amount / 100).toFixed(2)}/${config.recurring.interval}`,
      "info",
    );
    return { id: "dry_run_price_id" } as Stripe.Price;
  }

  // Archive existing price if forcing update
  if (existingPrice && FORCE_UPDATE) {
    log(`Archiving old price "${config.nickname}" (${existingPrice.id})...`, "info");
    await stripe.prices.update(existingPrice.id, { active: false });
  }

  log(
    `Creating price: ${config.nickname} - $${(config.unit_amount / 100).toFixed(2)}/${config.recurring.interval}...`,
    "info",
  );
  const price = await stripe.prices.create({
    product: productId,
    nickname: config.nickname,
    unit_amount: config.unit_amount,
    currency: "usd",
    recurring: config.recurring,
    metadata: {
      ...config.metadata,
      product_id: productConfigId,
    },
    tax_behavior: "exclusive",
  });
  log(`Created price: ${price.id}`, "success");
  return price;
}

async function setupBillingPortal(): Promise<void> {
  if (DRY_RUN) {
    log("[DRY RUN] Would configure billing portal", "info");
    return;
  }

  try {
    // Check for existing configurations
    const existingConfigs = await stripe.billingPortal.configurations.list({ limit: 1 });

    if (existingConfigs.data.length > 0 && !FORCE_UPDATE) {
      log("Billing portal already configured, skipping...", "warning");
      return;
    }

    log("Configuring billing portal...", "info");
    await stripe.billingPortal.configurations.create(BILLING_PORTAL_CONFIG);
    log("Billing portal configured", "success");
  } catch (error) {
    log(`Failed to configure billing portal: ${error}`, "error");
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log("\n🚀 Nuclom Stripe IaC Setup\n");
  console.log("=".repeat(50));

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  if (FORCE_UPDATE) {
    console.log("⚠️  FORCE UPDATE MODE - Existing resources will be updated\n");
  }

  console.log("📋 Pricing Configuration:");
  console.log("   Pro Plan:");
  console.log("   • Monthly: $25/user/month (prorated daily refund)");
  console.log("   • Yearly:  $19/user/month ($228/year, 24% off, non-refundable)");
  console.log("   Enterprise Plan:");
  console.log("   • Monthly: $99/user/month (prorated daily refund)");
  console.log("   • Yearly:  $82.50/user/month ($990/year, 17% off, non-refundable)");
  console.log("   Trial:   14 days (no credit card required)\n");
  console.log("=".repeat(50) + "\n");

  const createdResources: {
    products: Array<{ name: string; id: string }>;
    prices: Array<{ nickname: string; id: string; amount: string }>;
  } = {
    products: [],
    prices: [],
  };

  // Create products and prices
  for (const productConfig of PRODUCTS) {
    console.log(`\n📦 Processing product: ${productConfig.name}`);
    console.log("-".repeat(40));

    const product = await createProduct(productConfig);
    createdResources.products.push({ name: productConfig.name, id: product.id });

    for (const priceConfig of productConfig.prices) {
      const price = await createPrice(product.id, priceConfig, productConfig.id);
      createdResources.prices.push({
        nickname: priceConfig.nickname,
        id: price.id,
        amount: `$${(priceConfig.unit_amount / 100).toFixed(2)}/${priceConfig.recurring.interval}`,
      });
    }
  }

  // Configure billing portal
  console.log("\n⚙️  Billing Portal Configuration");
  console.log("-".repeat(40));
  await setupBillingPortal();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary\n");

  if (!DRY_RUN) {
    console.log("Created/Updated Products:");
    for (const product of createdResources.products) {
      console.log(`  • ${product.name}: ${product.id}`);
    }

    console.log("\nCreated/Updated Prices:");
    for (const price of createdResources.prices) {
      console.log(`  • ${price.nickname}: ${price.id} (${price.amount})`);
    }

    // Find price IDs for environment variables
    const proMonthly = createdResources.prices.find((p) => p.nickname === "Pro Monthly");
    const proYearly = createdResources.prices.find((p) => p.nickname === "Pro Yearly");
    const enterpriseMonthly = createdResources.prices.find((p) => p.nickname === "Enterprise Monthly");
    const enterpriseYearly = createdResources.prices.find((p) => p.nickname === "Enterprise Yearly");

    console.log("\n" + "=".repeat(50));
    console.log("🔐 Required Environment Variables\n");
    console.log("Add these to your .env file:\n");
    console.log("# Stripe Configuration");
    console.log(`STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY?.substring(0, 10)}...`);
    console.log("STRIPE_PUBLISHABLE_KEY=pk_...");
    console.log("STRIPE_WEBHOOK_SECRET=whsec_...");
    console.log("");
    console.log("# Better Auth Stripe Price IDs");
    console.log(`STRIPE_PRICE_ID_PRO_MONTHLY=${proMonthly?.id || "price_xxx"}`);
    console.log(`STRIPE_PRICE_ID_PRO_YEARLY=${proYearly?.id || "price_xxx"}`);
    console.log(`STRIPE_PRICE_ID_ENTERPRISE_MONTHLY=${enterpriseMonthly?.id || "price_xxx"}`);
    console.log(`STRIPE_PRICE_ID_ENTERPRISE_YEARLY=${enterpriseYearly?.id || "price_xxx"}`);
    console.log("");
    console.log("# Application URLs");
    console.log("NEXT_PUBLIC_APP_URL=https://your-app.com");
    console.log("");

    console.log("=".repeat(50));
    console.log("🔗 Webhook Endpoints to Configure\n");
    console.log("Configure these webhooks in Stripe Dashboard:\n");
    console.log("1. Better Auth Stripe Webhook (handles subscriptions):");
    console.log("   URL: https://your-app.com/api/auth/stripe/webhook");
    console.log("   Events: customer.subscription.*, checkout.session.completed");
    console.log("");
    console.log("2. Custom Webhook (handles invoices, payments):");
    console.log("   URL: https://your-app.com/api/webhooks/stripe");
    console.log("   Events: invoice.*, payment_method.*, customer.subscription.trial_will_end");
    console.log("");

    console.log("📝 Next Steps:");
    console.log("   1. Copy the environment variables above to your .env file");
    console.log("   2. Run database migrations: pnpm drizzle-kit migrate");
    console.log("   3. Configure webhook endpoints in Stripe Dashboard");
    console.log("   4. Test the checkout flow in Stripe test mode");
  } else {
    console.log("No resources were created (dry run mode)");
  }

  console.log("\n✅ Stripe setup complete!\n");
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
