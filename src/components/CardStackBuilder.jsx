import { useState, useEffect } from 'react';
import cardsData from '../data/cards.json';

const CardStackBuilder = () => {
  const [spending, setSpending] = useState({
    rent: 0,
    groceries: 400,
    gas: 200,
    dining: 250,
    online: 300,
    travel: 100,
    streaming: 50,
    other: 500,
  });

  const [results, setResults] = useState(null);

  const categoryLabels = {
    rent: 'Rent',
    groceries: 'Groceries',
    gas: 'Gas',
    dining: 'Dining/Restaurants',
    online: 'Online Shopping',
    travel: 'Travel',
    streaming: 'Streaming Services',
    other: 'Everything Else',
  };

  // Calculate rewards for a single card against user spending
  const calculateCardRewards = (card, userSpending) => {
    let totalRewards = 0;
    const breakdown = {};

    for (const [category, monthlyAmount] of Object.entries(userSpending)) {
      const annualAmount = monthlyAmount * 12;
      let categoryReward = 0;

      // Find the best rate for this category on this card
      let bestRate = card.rewardRates.find(r => r.category === category);
      
      // Fallback to "other" if no specific category match
      if (!bestRate) {
        bestRate = card.rewardRates.find(r => r.category === 'other');
      }

      if (bestRate) {
        let applicableAmount = annualAmount;
        
        // Handle caps
        if (bestRate.cap && bestRate.capPeriod === 'year') {
          applicableAmount = Math.min(annualAmount, bestRate.cap);
        }

        // Calculate reward value
        if (bestRate.unit === 'cashback') {
          categoryReward = applicableAmount * bestRate.rate;
        } else if (bestRate.unit === 'point') {
          const pointsEarned = applicableAmount * bestRate.rate;
          categoryReward = pointsEarned * (bestRate.pointValue || 0.01);
        }

        // Handle any overflow beyond cap
        if (bestRate.cap && annualAmount > bestRate.cap) {
          const overflow = annualAmount - bestRate.cap;
          const baseRate = card.rewardRates.find(r => r.category === 'other');
          if (baseRate) {
            if (baseRate.unit === 'cashback') {
              categoryReward += overflow * baseRate.rate;
            } else if (baseRate.unit === 'point') {
              categoryReward += overflow * baseRate.rate * (baseRate.pointValue || 0.01);
            }
          }
        }
      }

      breakdown[category] = categoryReward;
      totalRewards += categoryReward;
    }

    const netValue = totalRewards - card.annualFee;

    return {
      card,
      totalRewards,
      annualFee: card.annualFee,
      netValue,
      breakdown,
    };
  };

  // Calculate optimal stack for a given set of cards
  const calculateStackRewards = (cards, userSpending) => {
    const categoryAssignments = {};
    let totalRewards = 0;
    let totalFees = 0;

    for (const card of cards) {
      totalFees += card.annualFee;
    }

    // For each spending category, assign it to the card with the best rate
    for (const [category, monthlyAmount] of Object.entries(userSpending)) {
      const annualAmount = monthlyAmount * 12;
      let bestCardForCategory = null;
      let bestReward = 0;

      for (const card of cards) {
        let categoryRate = card.rewardRates.find(r => r.category === category);
        if (!categoryRate) {
          categoryRate = card.rewardRates.find(r => r.category === 'other');
        }

        if (categoryRate) {
          let applicableAmount = annualAmount;
          if (categoryRate.cap && categoryRate.capPeriod === 'year') {
            applicableAmount = Math.min(annualAmount, categoryRate.cap);
          }

          let reward = 0;
          if (categoryRate.unit === 'cashback') {
            reward = applicableAmount * categoryRate.rate;
          } else if (categoryRate.unit === 'point') {
            reward = applicableAmount * categoryRate.rate * (categoryRate.pointValue || 0.01);
          }

          if (reward > bestReward) {
            bestReward = reward;
            bestCardForCategory = card;
          }
        }
      }

      if (bestCardForCategory) {
        if (!categoryAssignments[bestCardForCategory.id]) {
          categoryAssignments[bestCardForCategory.id] = {
            card: bestCardForCategory,
            categories: [],
            reward: 0,
          };
        }
        categoryAssignments[bestCardForCategory.id].categories.push(category);
        categoryAssignments[bestCardForCategory.id].reward += bestReward;
        totalRewards += bestReward;
      }
    }

    const netValue = totalRewards - totalFees;

    return {
      cards,
      totalRewards,
      totalFees,
      netValue,
      assignments: Object.values(categoryAssignments),
    };
  };

  // Find best 1-card, 2-card, and 3-card combinations
  const findBestStacks = (userSpending) => {
    const cards = cardsData;

    // Best 1-card
    let best1Card = null;
    for (const card of cards) {
      const result = calculateCardRewards(card, userSpending);
      if (!best1Card || result.netValue > best1Card.netValue) {
        best1Card = result;
      }
    }

    // Best 2-card stack
    let best2CardStack = null;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const stack = calculateStackRewards([cards[i], cards[j]], userSpending);
        if (!best2CardStack || stack.netValue > best2CardStack.netValue) {
          best2CardStack = stack;
        }
      }
    }

    // Best 3-card stack
    let best3CardStack = null;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (let k = j + 1; k < cards.length; k++) {
          const stack = calculateStackRewards([cards[i], cards[j], cards[k]], userSpending);
          if (!best3CardStack || stack.netValue > best3CardStack.netValue) {
            best3CardStack = stack;
          }
        }
      }
    }

    // Calculate baseline comparisons
    const baseline1_5 = Object.values(userSpending).reduce((sum, val) => sum + val, 0) * 12 * 0.015;
    const baseline2_0 = Object.values(userSpending).reduce((sum, val) => sum + val, 0) * 12 * 0.02;

    return {
      best1Card,
      best2CardStack,
      best3CardStack,
      baseline1_5,
      baseline2_0,
    };
  };

  useEffect(() => {
    const calculated = findBestStacks(spending);
    setResults(calculated);
  }, [spending]);

  const handleSpendingChange = (category, value) => {
    setSpending(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0,
    }));
  };

  const resetToDefaults = () => {
    setSpending({
      rent: 0,
      groceries: 400,
      gas: 200,
      dining: 250,
      online: 300,
      travel: 100,
      streaming: 50,
      other: 500,
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isTylersStack = (cards) => {
    const ids = cards.map(c => c.id).sort();
    const tylersIds = ['bilt-mastercard', 'costco-anywhere-visa', 'bilt-palladium'].sort();
    return JSON.stringify(ids) === JSON.stringify(tylersIds);
  };

  return (
    <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>
            Your Monthly Spending
          </h3>
          <button
            onClick={resetToDefaults}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--color-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Reset to defaults
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <div key={key}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--color-text)',
                marginBottom: '0.5rem',
              }}>
                {label}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                  fontSize: '1rem',
                  pointerEvents: 'none',
                }}>
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={spending[key]}
                  onChange={(e) => handleSpendingChange(key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 1.75rem',
                    fontSize: '1rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'white',
                  }}
                />
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                {formatCurrency(spending[key] * 12)}/year
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: 'var(--color-secondary-bg)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
        }}>
          <strong>Note:</strong> Categories like Amazon, Costco, and Whole Foods count under their respective parent categories for most cards.
        </div>
      </div>

      {results && (
        <div>
          {/* Best 3-Card Stack */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-accent)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>
                Best 3-Card Stack (Maximum Value)
              </h3>
              {isTylersStack(results.best3CardStack.cards) && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #f59e0b',
                }}>
                  🦔 Tyler's Pick
                </span>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              {results.best3CardStack.assignments.map((assignment, idx) => (
                <div key={idx} style={{
                  padding: '1rem',
                  marginBottom: '1rem',
                  backgroundColor: 'var(--color-bg-alt)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-text)' }}>
                        {assignment.card.name}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {assignment.card.issuer} • {assignment.card.network}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-success)' }}>
                        {formatCurrency(assignment.reward)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        per year
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <strong>Handles:</strong> {assignment.categories.map(c => categoryLabels[c]).join(', ')}
                  </div>
                  {assignment.card.annualFee > 0 && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', marginTop: '0.25rem' }}>
                      Annual fee: {formatCurrency(assignment.card.annualFee)}
                    </div>
                  )}
                  <a
                    href={assignment.card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '0.75rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'white',
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#e67e22'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'var(--color-accent)'}
                  >
                    Apply Now →
                  </a>
                </div>
              ))}
            </div>

            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                TOTAL NET ANNUAL VALUE
              </div>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: '#22c55e', lineHeight: '1', marginBottom: '0.5rem' }}>
                {formatCurrency(results.best3CardStack.netValue)} 🦔
              </div>
              <div style={{ fontSize: '0.875rem', color: '#166534' }}>
                Total rewards: {formatCurrency(results.best3CardStack.totalRewards)} - Fees: {formatCurrency(results.best3CardStack.totalFees)}
              </div>
              {results.best3CardStack.netValue > results.baseline2_0 && (
                <div style={{ fontSize: '0.875rem', color: '#166534', marginTop: '0.5rem', fontWeight: '600' }}>
                  You'd earn {formatCurrency(results.best3CardStack.netValue - results.baseline2_0)} MORE per year vs. a simple 2% card
                </div>
              )}
            </div>
          </div>

          {/* Best 2-Card Stack */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '1rem' }}>
              Best 2-Card Stack (Balanced)
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              {results.best2CardStack.assignments.map((assignment, idx) => (
                <div key={idx} style={{
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  backgroundColor: 'var(--color-bg-alt)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text)' }}>
                      {assignment.card.name}
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-success)' }}>
                      {formatCurrency(assignment.reward)}/yr
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    {assignment.categories.map(c => categoryLabels[c]).join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-secondary-bg)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-secondary)' }}>
                {formatCurrency(results.best2CardStack.netValue)}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                net annual value
              </div>
            </div>
          </div>

          {/* Best 1-Card */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '1rem' }}>
              Best Single Card (Simplest)
            </h3>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-alt)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                {results.best1Card.card.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {results.best1Card.card.highlights.join(' • ')}
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-secondary-bg)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--color-secondary)' }}>
                {formatCurrency(results.best1Card.netValue)}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                net annual value
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardStackBuilder;
