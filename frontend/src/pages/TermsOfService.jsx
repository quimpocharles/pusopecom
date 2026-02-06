import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
  return (
    <Layout>
      <SEO title="Terms of Service" description="Terms and conditions for using the Puso Pilipinas online store." />
      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto prose prose-gray">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

          <p>
            Welcome to Puso Pilipinas. By accessing or using our website, creating an account, or placing an order,
            you agree to be bound by these Terms of Service. Please read them carefully before using our services.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. General</h2>
          <p>
            Puso Pilipinas is an online store specializing in Philippine sports merchandise.
            These terms govern your use of our website and the purchase of products from our store.
            We reserve the right to update these terms at any time, with changes effective upon posting.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Accounts</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>You may browse products without an account, but an account is required to place orders, write reviews, and manage your profile</li>
            <li>You are responsible for maintaining the confidentiality of your login credentials</li>
            <li>You must provide accurate and complete information when creating your account</li>
            <li>You may not create accounts for fraudulent purposes or impersonate others</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Products and Pricing</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>All prices are listed in Philippine Pesos (PHP) and include applicable taxes unless stated otherwise</li>
            <li>We strive to display accurate product images and descriptions, but slight variations may occur</li>
            <li>We reserve the right to update pricing, modify, or discontinue products at any time without prior notice</li>
            <li>Promotional prices and sale items are available for a limited time and subject to stock availability</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Orders and Payments</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Placing an order constitutes an offer to purchase. We reserve the right to accept or decline orders</li>
            <li>Payments are processed securely through <strong>Maya (PayMaya)</strong>. We do not store your payment card details</li>
            <li>Orders are confirmed only upon successful payment. You will receive an email confirmation once payment is verified</li>
            <li>If payment fails, your order will be marked accordingly and stock will be restored</li>
            <li>We reserve the right to cancel orders suspected of fraud</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Shipping</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>We ship to addresses within the Philippines</li>
            <li>A flat shipping fee of PHP 150.00 applies per order</li>
            <li>Delivery times vary by location and are estimates only</li>
            <li>Risk of loss passes to you upon delivery to the shipping carrier</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Returns and Refunds</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>If you receive a defective or incorrect item, please contact us within 7 days of delivery</li>
            <li>Items must be unused, in original packaging, and in resalable condition to be eligible for return</li>
            <li>Refunds will be processed to the original payment method within 7-14 business days after we receive the returned item</li>
            <li>Shipping fees are non-refundable unless the return is due to our error</li>
            <li>Custom or personalized items are non-returnable</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Product Reviews</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Reviews must be honest and based on your genuine experience with the product</li>
            <li>We reserve the right to remove reviews that contain offensive language, spam, or false information</li>
            <li>By submitting a review, you grant us the right to display it on our website</li>
            <li>Each customer may submit one review per product</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">8. Virtual Try-On</h2>
          <p>
            Our virtual try-on feature uses AI to generate preview images. These are approximate
            representations and may not perfectly reflect actual product appearance. Photos you upload
            are processed temporarily and are not stored on our servers.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">9. Intellectual Property</h2>
          <p>
            All content on this website — including product images, text, logos, and design — is the property
            of Puso Pilipinas or its licensors. You may not reproduce, distribute, or use any content from
            this website without prior written consent. Team names, logos, and league trademarks belong to
            their respective owners.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by Philippine law, Puso Pilipinas shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of our website
            or purchase of products. Our total liability shall not exceed the amount paid for the specific
            product or order giving rise to the claim.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">11. Governing Law</h2>
          <p>
            These Terms of Service are governed by and construed in accordance with the laws of the
            Republic of the Philippines. Any disputes shall be resolved in the appropriate courts of
            the Philippines.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">12. Privacy</h2>
          <p>
            Your use of our website is also governed by our{' '}
            <Link to="/privacy" className="text-primary-600 hover:text-primary-700">Privacy Policy</Link>,
            which details how we collect, use, and protect your personal information.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">13. Contact Us</h2>
          <p>
            For questions or concerns about these terms, please contact us at:{' '}
            <a href="mailto:support@pusopilipinas.com" className="text-primary-600 hover:text-primary-700">
              support@pusopilipinas.com
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default TermsOfService;
