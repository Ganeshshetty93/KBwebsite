import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiCancelPaymentReturn, apiCompletePaymentReturn } from '../utils/api.js';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading', title: 'Confirming payment', message: 'Please wait while we verify your PayPal payment.' });

  useEffect(() => {
    const payment = searchParams.get('payment');
    const kind = searchParams.get('kind') || 'class';
    const registrationId = searchParams.get('registrationId');
    const token = searchParams.get('token');
    const returnToken = searchParams.get('rt');
    const errorMessage = searchParams.get('message');

    if (payment === 'error') {
      setState({ status: 'error', title: 'Payment could not be started', message: errorMessage || 'Please request a new payment link or contact Kannada Bharati support.' });
      return;
    }
    if (payment === 'paid') {
      setState({ status: 'success', title: 'Payment already completed', message: 'This registration is already marked as paid.' });
      return;
    }
    if (!['class', 'event', 'guest-event', 'guest'].includes(kind)) {
      setState({ status: 'error', title: 'Unsupported payment return', message: 'This payment return link is not valid.' });
      return;
    }
    if (!registrationId || !returnToken) {
      setState({ status: 'error', title: 'Missing payment details', message: 'The payment return link is missing registration details.' });
      return;
    }

    let ignore = false;
    const payload = { registrationId, token, returnToken };
    const action = payment === 'cancel'
      ? apiCancelPaymentReturn(kind, payload)
      : apiCompletePaymentReturn(kind, payload);

    action
      .then((result) => {
        if (ignore) return;
        if (payment === 'cancel') {
          setState({ status: 'cancel', title: 'Payment cancelled', message: 'Your registration remains pending. You can use the payment link again when ready.' });
          return;
        }
        setState({
          status: 'success',
          title: 'Payment successful',
          message: result?.registration?.program
            ? `${result.registration.program} is now marked as paid.`
            : 'Your class registration payment is complete.'
        });
      })
      .catch((error) => {
        if (!ignore) {
          setState({ status: 'error', title: 'Payment could not be verified', message: error.message || 'Please contact Kannada Bharati support.' });
        }
      });

    return () => {
      ignore = true;
    };
  }, [searchParams]);

  const Icon = state.status === 'loading' ? Loader2 : state.status === 'success' ? CheckCircle2 : XCircle;

  return (
    <main className="payment-return-page">
      <section className={`payment-return-card is-${state.status}`} aria-live="polite">
        <span className="payment-return-icon"><Icon size={38} className={state.status === 'loading' ? 'spin-icon' : ''} /></span>
        <h1>{state.title}</h1>
        <p>{state.message}</p>
        <div className="payment-return-actions">
          <Link className="button primary" to="/admin/profile?tab=registrations">View my registrations</Link>
          <Link className="button secondary-dark" to="/classes">Back to classes</Link>
        </div>
      </section>
    </main>
  );
}
