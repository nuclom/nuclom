/**
 * Stripe Infrastructure as Code (IaC) Setup Script
 *
 * This script creates and configures all Stripe products, prices, and billing settings
 * for the Nuclom video collaboration platform.
 *
 * Pricing Configuration (Yearly shown as default, 15% off monthly):
 * - Scale:  $29/user/month yearly ($348/year) | $34/user/month monthly
 * - Growth: $49/user/month yearly ($588/year) | $58/user/month monthly
 * - Pro:    $79/user/month yearly ($948/year) | $93/user/month monthly
 * - Trial: 14 days (no credit card required)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... npx tsx scripts/setup-stripe.ts
 *
 * Options:
 *   --dry-run    Preview changes without creating resources
 *   --force      Update existing resources instead of skipping
 */

import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config({ path: ['.env.local', '.env'] });

// =============================================================================
// Configuration
// =============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE_UPDATE = args.includes('--force');

// =============================================================================
// Product & Price Definitions
// =============================================================================

interface PriceConfig {
  nickname: string;
  unit_amount: number; // in cents
  recurring: {
    interval: 'month' | 'year';
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
    id: 'prod_nuclom_scale',
    name: 'Nuclom Scale',
    description: 'For small teams getting started with unified knowledge management. Up to 10 members, 3 knowledge sources.',
    metadata: {
      plan_type: 'scale',
      trial_days: '14',
      features: 'ai_insights,transcription,collaboration,integrations',
      members_limit: '10',
      sources_limit: '3',
    },
    prices: [
      {
        nickname: 'Scale Monthly',
        unit_amount: 3400, // $34.00
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'monthly',
          refund_policy: 'prorated_daily',
          price_per_user: '34.00',
        },
      },
      {
        nickname: 'Scale Yearly',
        unit_amount: 34800, // $348.00/year = $29/month
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'yearly',
          refund_policy: 'non_refundable',
          price_per_user: '29.00',
          yearly_savings: '15%',
        },
      },
    ],
  },
  {
    id: 'prod_nuclom_growth',
    name: 'Nuclom Growth',
    description: 'For growing teams that need more capacity and premium features. Up to 30 members, 6 knowledge sources, priority support.',
    metadata: {
      plan_type: 'growth',
      trial_days: '14',
      features: 'ai_insights,transcription,collaboration,integrations,custom_branding,priority_support',
      members_limit: '30',
      sources_limit: '6',
    },
    prices: [
      {
        nickname: 'Growth Monthly',
        unit_amount: 5800, // $58.00
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'monthly',
          refund_policy: 'prorated_daily',
          price_per_user: '58.00',
        },
      },
      {
        nickname: 'Growth Yearly',
        unit_amount: 58800, // $588.00/year = $49/month
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'yearly',
          refund_policy: 'non_refundable',
          price_per_user: '49.00',
          yearly_savings: '15%',
        },
      },
    ],
  },
  {
    id: 'prod_nuclom_pro',
    name: 'Nuclom Pro',
    description: 'For organizations requiring unlimited scale, SSO, audit logs, and dedicated support.',
    metadata: {
      plan_type: 'pro',
      trial_days: '14',
      features: 'unlimited,sso,audit_logs,dedicated_support,custom_branding,advanced_permissions',
      members_limit: 'unlimited',
      sources_limit: 'unlimited',
    },
    prices: [
      {
        nickname: 'Pro Monthly',
        unit_amount: 9300, // $93.00
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'monthly',
          refund_policy: 'prorated_daily',
          price_per_user: '93.00',
        },
      },
      {
        nickname: 'Pro Yearly',
        unit_amount: 94800, // $948.00/year = $79/month
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'yearly',
          refund_policy: 'non_refundable',
          price_per_user: '79.00',
          yearly_savings: '15%',
        },
      },
    ],
  },
];

// Billing Portal Configuration
const BILLING_PORTAL_CONFIG: Stripe.BillingPortal.ConfigurationCreateParams = {
  business_profile: {
    headline: 'Nuclom - Manage your subscription',
    privacy_policy_url: 'https://nuclom.com/privacy',
    terms_of_service_url: 'https://nuclom.com/terms',
  },
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ['email', 'name', 'address', 'phone'],
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
    },
  },
  default_return_url: 'https://nuclom.com/settings/billing',
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

async function findExistingPrice(productId: string, interval: string): Promise<Stripe.Price | null> {
  try {
    const prices = await stripe.prices.list({
      limit: 100,
      active: true,
    });
    return (
      prices.data.find(
        (p) =>
          typeof p.product === 'string' &&
          p.metadata.billing_period === interval &&
          p.metadata.product_id === productId,
      ) || null
    );
  } catch {
    return null;
  }
}

function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
  };
  console.log(`${prefix[type]} ${message}`);
}

// =============================================================================
// Setup Functions
// =============================================================================

async function createProduct(config: ProductConfig): Promise<Stripe.Product> {
  const existingProduct = await findExistingProduct(config.id);

  if (existingProduct && !FORCE_UPDATE) {
    log(`Product "${config.name}" already exists (${existingProduct.id}), skipping...`, 'warning');
    return existingProduct;
  }

  if (DRY_RUN) {
    log(`[DRY RUN] Would create product: ${config.name}`, 'info');
    return { id: 'dry_run_product_id' } as Stripe.Product;
  }

  if (existingProduct && FORCE_UPDATE) {
    log(`Updating existing product "${config.name}"...`, 'info');
    const updated = await stripe.products.update(existingProduct.id, {
      name: config.name,
      description: config.description,
      metadata: {
        ...config.metadata,
        product_id: config.id,
      },
    });
    log(`Updated product: ${updated.id}`, 'success');
    return updated;
  }

  log(`Creating product: ${config.name}...`, 'info');
  const product = await stripe.products.create({
    name: config.name,
    description: config.description,
    metadata: {
      ...config.metadata,
      product_id: config.id,
    },
  });
  log(`Created product: ${product.id}`, 'success');
  return product;
}

async function createPrice(productId: string, config: PriceConfig, productConfigId: string): Promise<Stripe.Price> {
  const billingPeriod = config.metadata.billing_period;
  const existingPrice = await findExistingPrice(productConfigId, billingPeriod);

  if (existingPrice && !FORCE_UPDATE) {
    log(`Price "${config.nickname}" already exists (${existingPrice.id}), skipping...`, 'warning');
    return existingPrice;
  }

  if (DRY_RUN) {
    log(
      `[DRY RUN] Would create price: ${config.nickname} - $${(config.unit_amount / 100).toFixed(2)}/${config.recurring.interval}`,
      'info',
    );
    return { id: 'dry_run_price_id' } as Stripe.Price;
  }

  // Archive existing price if forcing update
  if (existingPrice && FORCE_UPDATE) {
    log(`Archiving old price "${config.nickname}" (${existingPrice.id})...`, 'info');
    await stripe.prices.update(existingPrice.id, { active: false });
  }

  log(
    `Creating price: ${config.nickname} - $${(config.unit_amount / 100).toFixed(2)}/${config.recurring.interval}...`,
    'info',
  );
  const price = await stripe.prices.create({
    product: productId,
    nickname: config.nickname,
    unit_amount: config.unit_amount,
    currency: 'usd',
    recurring: config.recurring,
    metadata: {
      ...config.metadata,
      product_id: productConfigId,
    },
    tax_behavior: 'exclusive',
  });
  log(`Created price: ${price.id}`, 'success');
  return price;
}

async function setupBillingPortal(): Promise<void> {
  if (DRY_RUN) {
    log('[DRY RUN] Would configure billing portal', 'info');
    return;
  }

  try {
    // Check for existing configurations
    const existingConfigs = await stripe.billingPortal.configurations.list({ limit: 1 });

    if (existingConfigs.data.length > 0 && !FORCE_UPDATE) {
      log('Billing portal already configured, skipping...', 'warning');
      return;
    }

    log('Configuring billing portal...', 'info');
    await stripe.billingPortal.configurations.create(BILLING_PORTAL_CONFIG);
    log('Billing portal configured', 'success');
  } catch (error) {
    log(`Failed to configure billing portal: ${error}`, 'error');
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log('\n🚀 Nuclom Stripe IaC Setup\n');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (FORCE_UPDATE) {
    console.log('⚠️  FORCE UPDATE MODE - Existing resources will be updated\n');
  }

  console.log('📋 Pricing Configuration (Yearly shown as default):');
  console.log('');
  console.log('   Scale Plan:');
  console.log('   • Yearly:  $29/user/month ($348/year) - 15% off');
  console.log('   • Monthly: $34/user/month');
  console.log('   • Limits: 10 members, 3 sources, 5GB/user storage');
  console.log('');
  console.log('   Growth Plan:');
  console.log('   • Yearly:  $49/user/month ($588/year) - 15% off');
  console.log('   • Monthly: $58/user/month');
  console.log('   • Limits: 30 members, 6 sources, 15GB/user storage');
  console.log('');
  console.log('   Pro Plan:');
  console.log('   • Yearly:  $79/user/month ($948/year) - 15% off');
  console.log('   • Monthly: $93/user/month');
  console.log('   • Limits: Unlimited members, Unlimited sources, 50GB/user');
  console.log('');
  console.log('   Trial: 14 days (no credit card required)');
  console.log('');
  console.log(`${'='.repeat(60)}\n`);

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
    console.log('-'.repeat(40));

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
  console.log('\n⚙️  Billing Portal Configuration');
  console.log('-'.repeat(40));
  await setupBillingPortal();

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Summary\n');

  if (!DRY_RUN) {
    console.log('Created/Updated Products:');
    for (const product of createdResources.products) {
      console.log(`  • ${product.name}: ${product.id}`);
    }

    console.log('\nCreated/Updated Prices:');
    for (const price of createdResources.prices) {
      console.log(`  • ${price.nickname}: ${price.id} (${price.amount})`);
    }

    // Find price IDs for environment variables
    const scaleMonthly = createdResources.prices.find((p) => p.nickname === 'Scale Monthly');
    const scaleYearly = createdResources.prices.find((p) => p.nickname === 'Scale Yearly');
    const growthMonthly = createdResources.prices.find((p) => p.nickname === 'Growth Monthly');
    const growthYearly = createdResources.prices.find((p) => p.nickname === 'Growth Yearly');
    const proMonthly = createdResources.prices.find((p) => p.nickname === 'Pro Monthly');
    const proYearly = createdResources.prices.find((p) => p.nickname === 'Pro Yearly');

    console.log(`\n${'='.repeat(60)}`);
    console.log('🔐 Required Environment Variables\n');
    console.log('Add these to your .env file:\n');
    console.log('# Stripe Configuration');
    console.log(`STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY?.substring(0, 10)}...`);
    console.log('STRIPE_PUBLISHABLE_KEY=pk_...');
    console.log('STRIPE_WEBHOOK_SECRET=whsec_...');
    console.log('');
    console.log('# Stripe Price IDs');
    console.log(`STRIPE_PRICE_ID_SCALE_MONTHLY=${scaleMonthly?.id || 'price_xxx'}`);
    console.log(`STRIPE_PRICE_ID_SCALE_YEARLY=${scaleYearly?.id || 'price_xxx'}`);
    console.log(`STRIPE_PRICE_ID_GROWTH_MONTHLY=${growthMonthly?.id || 'price_xxx'}`);
    console.log(`STRIPE_PRICE_ID_GROWTH_YEARLY=${growthYearly?.id || 'price_xxx'}`);
    console.log(`STRIPE_PRICE_ID_PRO_MONTHLY=${proMonthly?.id || 'price_xxx'}`);
    console.log(`STRIPE_PRICE_ID_PRO_YEARLY=${proYearly?.id || 'price_xxx'}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('🔗 Webhook Endpoint to Configure\n');
    console.log('Configure this single webhook in Stripe Dashboard:\n');
    console.log('   URL: https://your-app.com/api/webhooks/stripe');
    console.log('   Events:');
    console.log('     - customer.subscription.* (all subscription events)');
    console.log('     - checkout.session.completed');
    console.log('     - invoice.* (all invoice events)');
    console.log('     - payment_method.attached');
    console.log('     - payment_method.detached');
    console.log('');

    console.log('📝 Next Steps:');
    console.log('   1. Copy the environment variables above to your .env file');
    console.log('   2. Run database migrations: pnpm db:migrate');
    console.log('   3. Configure webhook endpoints in Stripe Dashboard');
    console.log('   4. Test the checkout flow in Stripe test mode');
  } else {
    console.log('No resources were created (dry run mode)');
  }

  console.log('\n✅ Stripe setup complete!\n');
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
