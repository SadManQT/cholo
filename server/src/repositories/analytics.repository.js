import { pool } from '../config/db.js';

// Ten admin reports, each one plain SQL. The admin Analytics page shows each question, its answer and
// the exact SQL below. $1 is a value sent separately from the SQL, like :month in Oracle; `params`
// says what it is for each report (the chosen month, or the minimum number of trips).

export const REPORTS = [
  {
    id: 'peak-hour',
    number: 9,
    title: 'Peak ride hour',
    question: 'At which hour of the day do riders request the most rides?',
    concepts: ['EXTRACT', 'GROUP BY', 'COUNT'],
    sql: `
SELECT EXTRACT(HOUR FROM r.requested_at) AS hour_of_day,
       COUNT(*) AS total_requests
FROM ride_requests r
GROUP BY EXTRACT(HOUR FROM r.requested_at)
ORDER BY total_requests DESC
FETCH FIRST 5 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'revenue-hour',
    number: 10,
    title: 'Highest revenue hour',
    question: 'At which hour of the day do completed trips bring in the most money?',
    concepts: ['EXTRACT', 'GROUP BY', 'SUM'],
    sql: `
SELECT EXTRACT(HOUR FROM t.completed_at) AS hour_of_day,
       COUNT(*) AS completed_trips,
       SUM(t.total_fare) AS total_revenue
FROM trips t
WHERE t.status = 'completed'
GROUP BY EXTRACT(HOUR FROM t.completed_at)
ORDER BY total_revenue DESC
FETCH FIRST 5 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'revenue-day',
    number: 11,
    title: 'Highest revenue day of the month',
    question: 'In the chosen month, which days had the most successful trip payments?',
    concepts: ['TO_CHAR', 'WHERE', 'GROUP BY', 'SUM'],
    sql: `
SELECT TO_CHAR(p.completed_at, 'YYYY-MM-DD') AS payment_day,
       COUNT(*) AS payments,
       SUM(p.amount) AS total_amount
FROM payments p
WHERE p.status = 'succeeded'
  AND p.purpose = 'trip'
  AND TO_CHAR(p.completed_at, 'YYYY-MM') = $1
GROUP BY TO_CHAR(p.completed_at, 'YYYY-MM-DD')
ORDER BY total_amount DESC
FETCH FIRST 5 ROWS ONLY`,
    params: ({ month }) => [month],
  },
  {
    id: 'monthly-trend',
    number: 12,
    title: 'Monthly revenue trend',
    question: 'For each month: how many trips, how much money, the average fare, and how many different riders?',
    concepts: ['TO_CHAR', 'COUNT', 'SUM', 'AVG', 'COUNT(DISTINCT)'],
    sql: `
SELECT TO_CHAR(t.completed_at, 'YYYY-MM') AS month,
       COUNT(*) AS completed_trips,
       SUM(t.total_fare) AS gross_revenue,
       ROUND(AVG(t.total_fare), 2) AS average_fare,
       COUNT(DISTINCT t.passenger_id) AS different_riders
FROM trips t
WHERE t.status = 'completed'
GROUP BY TO_CHAR(t.completed_at, 'YYYY-MM')
ORDER BY month DESC
FETCH FIRST 12 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'monthly-commission',
    number: 13,
    title: 'Monthly platform commission',
    question: 'For each month: what riders paid, what drivers kept, and what Cholo earned (paid − kept)?',
    concepts: ['TO_CHAR', 'SUM', 'subtracting two SUMs'],
    sql: `
SELECT TO_CHAR(e.earned_at, 'YYYY-MM') AS month,
       SUM(e.gross_fare) AS riders_paid,
       SUM(e.net_earning) AS drivers_kept,
       SUM(e.gross_fare) - SUM(e.net_earning) AS platform_commission
FROM driver_earnings e
GROUP BY TO_CHAR(e.earned_at, 'YYYY-MM')
ORDER BY month DESC
FETCH FIRST 12 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'top-rated-drivers',
    number: 3,
    title: 'Top 5 drivers by rating',
    question: 'Who are the 5 best-rated drivers, counting only drivers with at least the minimum number of trips?',
    concepts: ['JOIN', 'LEFT JOIN', 'GROUP BY', 'HAVING', 'AVG'],
    sql: `
SELECT u.full_name AS driver_name,
       COUNT(t.id) AS completed_trips,
       ROUND(AVG(r.score), 2) AS average_rating
FROM trips t
JOIN users u ON u.id = t.driver_id
LEFT JOIN ratings r ON r.trip_id = t.id
                   AND r.rater_role = 'passenger'
WHERE t.status = 'completed'
GROUP BY u.id, u.full_name
HAVING COUNT(t.id) >= $1
ORDER BY average_rating DESC NULLS LAST, completed_trips DESC
FETCH FIRST 5 ROWS ONLY`,
    params: ({ minTrips }) => [minTrips],
  },
  {
    id: 'idle-online-drivers',
    number: 17,
    title: 'Online drivers with no ride today',
    question: 'Which drivers are online right now but have not been given a single trip today?',
    concepts: ['JOIN', 'NOT EXISTS', 'CURRENT_DATE'],
    sql: `
SELECT u.full_name AS driver_name,
       u.phone,
       TO_CHAR(a.last_ping_at, 'HH24:MI') AS last_seen
FROM driver_availability a
JOIN users u ON u.id = a.driver_id
WHERE a.status = 'online'
  AND NOT EXISTS (SELECT 1
                  FROM trips t
                  WHERE t.driver_id = a.driver_id
                    AND t.assigned_at >= CURRENT_DATE)
ORDER BY u.full_name
FETCH FIRST 10 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'inactive-drivers',
    number: 18,
    title: 'Inactive drivers',
    question: 'Which approved drivers have not completed any trip in the last 30 days?',
    concepts: ['JOIN', 'NOT EXISTS', 'subquery', 'MAX'],
    sql: `
SELECT u.full_name AS driver_name,
       u.phone,
       (SELECT TO_CHAR(MAX(t2.completed_at), 'YYYY-MM-DD')
        FROM trips t2
        WHERE t2.driver_id = d.user_id
          AND t2.status = 'completed') AS last_trip
FROM driver_profiles d
JOIN users u ON u.id = d.user_id
WHERE d.verification_status = 'approved'
  AND NOT EXISTS (SELECT 1
                  FROM trips t
                  WHERE t.driver_id = d.user_id
                    AND t.status = 'completed'
                    AND t.completed_at >= CURRENT_DATE - 30)
ORDER BY u.full_name
FETCH FIRST 10 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'rider-lifetime-value',
    number: 20,
    title: 'Rider lifetime value',
    question: 'For each rider: total trips, total spent, average fare, and their first and latest trip.',
    concepts: ['JOIN', 'GROUP BY', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
    sql: `
SELECT u.full_name AS rider_name,
       COUNT(*) AS total_trips,
       SUM(t.total_fare) AS total_spent,
       ROUND(AVG(t.total_fare), 2) AS average_fare,
       TO_CHAR(MIN(t.completed_at), 'YYYY-MM-DD') AS first_trip,
       TO_CHAR(MAX(t.completed_at), 'YYYY-MM-DD') AS latest_trip
FROM trips t
JOIN users u ON u.id = t.passenger_id
WHERE t.status = 'completed'
GROUP BY u.id, u.full_name
ORDER BY total_spent DESC
FETCH FIRST 10 ROWS ONLY`,
    params: () => [],
  },
  {
    id: 'frequent-pairs',
    number: 21,
    title: 'Most frequent driver–rider pair',
    question: 'Which driver and rider have completed the most trips together?',
    concepts: ['joining the same table twice', 'GROUP BY', 'COUNT'],
    sql: `
SELECT d.full_name AS driver_name,
       p.full_name AS rider_name,
       COUNT(*) AS trips_together
FROM trips t
JOIN users d ON d.id = t.driver_id
JOIN users p ON p.id = t.passenger_id
WHERE t.status = 'completed'
GROUP BY d.id, d.full_name, p.id, p.full_name
ORDER BY trips_together DESC
FETCH FIRST 5 ROWS ONLY`,
    params: () => [],
  },
];

export async function runReport(report, input, client = pool) {
  const { rows } = await client.query(report.sql, report.params(input));
  return rows;
}
