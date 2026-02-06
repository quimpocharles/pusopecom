import Layout from '../components/layout/Layout';
import SEO from '../components/common/SEO';

const PrivacyPolicy = () => {
  return (
    <Layout>
      <SEO title="Privacy Policy" description="Learn how Puso Pilipinas collects, uses, and protects your personal information." />
      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto prose prose-gray">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

          <p>
            Puso Pilipinas ("we", "our", or "us") operates the Puso Pilipinas online store. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your personal information when you visit our
            website and make purchases. This policy is in accordance with the
            {' '}<strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> of the Philippines.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Information We Collect</h2>

          <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Personal Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Account registration:</strong> First name, last name, email address, and password</li>
            <li><strong>Orders and checkout:</strong> Full name, phone number, shipping address (including region, province, city, barangay, and zip code), and email</li>
            <li><strong>Google OAuth login:</strong> Name and email address from your Google account</li>
            <li><strong>Product reviews:</strong> Your name (displayed as first name and last initial) and review content</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Authentication tokens:</strong> We store a JSON Web Token (JWT) in your browser's local storage to keep you logged in</li>
            <li><strong>Shopping cart data:</strong> Cart contents are stored in your browser's local storage so your cart persists between visits</li>
            <li><strong>Virtual try-on usage:</strong> When you use our virtual try-on feature, we log the product tried and whether the generation succeeded, for analytics purposes. We do not store the photos you upload — they are processed in memory only and discarded immediately.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Process and fulfill your orders</li>
            <li>Send order confirmation and shipping update emails</li>
            <li>Send email verification and password reset emails</li>
            <li>Display your reviews on product pages</li>
            <li>Generate aggregated analytics for our admin dashboard (sales reports, product performance, customer insights)</li>
            <li>Improve our website and services</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Third-Party Services</h2>
          <p>We share your information with the following third-party services only as necessary to operate our store:</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Maya (PayMaya):</strong> Payment processing. When you checkout, your order total and billing details are sent to Maya to process the payment. Maya's privacy policy governs their handling of your payment information.</li>
            <li><strong>Cloudinary:</strong> Product image hosting. No personal data is shared with Cloudinary.</li>
            <li><strong>Google:</strong> If you choose to log in with Google OAuth, we receive your name and email from Google.</li>
            <li><strong>Gmail (SMTP):</strong> We send transactional emails (order confirmations, verification, password resets) through Gmail's SMTP service.</li>
          </ul>
          <p className="mt-2">We do <strong>not</strong> sell, rent, or trade your personal information to any third parties for marketing purposes.</p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Data Storage and Security</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Your data is stored in a secure MongoDB database</li>
            <li>Passwords are hashed using bcrypt and are never stored in plain text</li>
            <li>API communication is protected with HTTPS</li>
            <li>Authentication uses JSON Web Tokens (JWT) with expiration</li>
            <li>We do not store credit card or payment card numbers — all payment processing is handled by Maya</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Your Rights</h2>
          <p>Under the Data Privacy Act of 2012, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Access</strong> your personal information that we hold</li>
            <li><strong>Correct</strong> inaccurate or incomplete information (via your Account settings)</li>
            <li><strong>Object</strong> to the processing of your personal data</li>
            <li><strong>Erasure or blocking</strong> of your personal data under certain conditions</li>
            <li><strong>Lodge a complaint</strong> with the National Privacy Commission (NPC)</li>
          </ul>
          <p className="mt-2">You can update your profile information, manage your addresses, and change your password at any time through your Account dashboard.</p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Cookies and Local Storage</h2>
          <p>
            We do not use traditional cookies for tracking. We use browser local storage for two purposes only:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Authentication token:</strong> To keep you logged in between sessions</li>
            <li><strong>Shopping cart:</strong> To persist your cart contents between visits</li>
          </ul>
          <p className="mt-2">You can clear this data at any time by clearing your browser's local storage or logging out.</p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Children's Privacy</h2>
          <p>Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors.</p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">8. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">9. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data privacy rights, please contact us at:{' '}
            <a href="mailto:support@pusopilipinas.com" className="text-primary-600 hover:text-primary-700">
              support@pusopilipinas.com
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;
