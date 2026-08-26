import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as geoApi from '../../api/geo.api';
import * as referenceApi from '../../api/reference.api';
import * as ridesApi from '../../api/rides.api';
import { MapView } from '../../components/map/MapView';
import { ConnectionPill } from '../../components/ride/ConnectionPill';
import { FareEstimateCard } from '../../components/ride/FareEstimateCard';
import { BottomSheet, Button, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import type { SnapPoint } from '../../components/ui/BottomSheet';
import { useSocket } from '../../context/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { LatLng, Place } from '../../types/geo.types';
import type {
  City,
  PaymentIntent,
  RideQuote,
  RideRequest,
  SocketTripStatus,
  VehicleCategory,
} from '../../types/ride.types';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { isWithinBangladeshBounds, SERVICE_AREA_NOTICE } from '../../utils/serviceArea';
import { staggerStyle } from '../../utils/stagger';

const ACTIVE_REQUEST_KEY = 'cholo.activeRideRequest';
type LocationField = 'pickup' | 'dropoff';

function locationLabel(field: LocationField) {
  return field === 'pickup' ? 'Pickup' : 'Dropoff';
}

export function BookRidePage() {
  const navigate = useNavigate();
  const { socket, connectionState } = useSocket();
  const geolocation = useGeolocation();
  const requestCurrentLocation = geolocation.request;
  const geolocationState = geolocation.state;
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [mapField, setMapField] = useState<LocationField>('dropoff');
  const [resolvingField, setResolvingField] = useState<LocationField | null>(null);
  const [quotes, setQuotes] = useState<Record<number, RideQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('half');

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedQuote = selectedCategoryId ? quotes[selectedCategoryId] : undefined;

  const loadReferences = useCallback(async () => {
    setReferenceLoading(true);
    setReferenceError(null);
    try {
      const [nextCities, nextCategories] = await Promise.all([
        referenceApi.listCities(),
        referenceApi.listVehicleCategories(),
      ]);
      setCities(nextCities);
      setCategories(nextCategories);
    } catch (error) {
      setReferenceError(getApiErrorMessage(error, 'Could not load ride options.'));
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    const storedPublicId = sessionStorage.getItem(ACTIVE_REQUEST_KEY);
    if (!storedPublicId) return;

    ridesApi.getRequest(storedPublicId)
      .then((request) => {
        if (request.tripCode) {
          sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
          navigate(`/trips/${request.tripCode}/live`, { replace: true });
          return;
        }
        if (request.status === 'searching' || request.status === 'pending') {
          setRideRequest(request);
          setPickup(request.pickup ?? null);
          setDropoff(request.dropoff ?? null);
        } else {
          sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
        }
      })
      .catch(() => sessionStorage.removeItem(ACTIVE_REQUEST_KEY));
  }, [navigate]);

  useEffect(() => {
    if (pickup || geolocationState !== 'idle') return;

    requestCurrentLocation()
      .then(async (position) => {
        if (!isWithinBangladeshBounds(position)) {
          toast.error(SERVICE_AREA_NOTICE);
          return;
        }
        try {
          const place = await geoApi.reverseGeocode(position.lat, position.lng);
          setPickup(place);
          setPickupQuery(place.address);
        } catch (error) {
          if (getApiErrorCode(error) === 'OUTSIDE_SERVICE_AREA') {
            toast.error(getApiErrorMessage(error, SERVICE_AREA_NOTICE));
            return;
          }
          const place = { lat: position.lat, lng: position.lng, address: 'Current location' };
          setPickup(place);
          setPickupQuery(place.address);
        }
      })
      .catch(() => {
        // Permission guidance is rendered in the sheet; map pin selection
        // remains available, so denial is not a dead end.
      });
  }, [geolocationState, pickup, requestCurrentLocation]);

  useEffect(() => {
    if (!pickup || !dropoff || cities.length === 0 || categories.length === 0 || rideRequest) return;
    let cancelled = false;

    async function loadQuotes() {
      setQuotesLoading(true);
      setQuoteError(null);
      const cityId = cities[0].id;
      const results = await Promise.allSettled(
        categories.map((category) => ridesApi.getQuote({
          cityId,
          categoryId: category.id,
          pickup: { lat: pickup!.lat, lng: pickup!.lng },
          dropoff: { lat: dropoff!.lat, lng: dropoff!.lng },
        })),
      );
      if (cancelled) return;

      const nextQuotes: Record<number, RideQuote> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') nextQuotes[categories[index].id] = result.value;
      });
      setQuotes(nextQuotes);
      const firstAvailable = categories.find((category) => nextQuotes[category.id]);
      setSelectedCategoryId((current) => current && nextQuotes[current] ? current : firstAvailable?.id ?? null);
      if (!firstAvailable) setQuoteError('No ride category is available for this route right now.');
      setQuotesLoading(false);
      setSnapPoint('half');
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [categories, cities, dropoff, pickup, rideRequest]);

  useEffect(() => {
    if (!rideRequest) return;
    let cancelled = false;

    async function refreshRequest() {
      try {
        const next = await ridesApi.getRequest(rideRequest!.publicId);
        if (cancelled) return;
        if (next.tripCode) {
          sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
          navigate(`/trips/${next.tripCode}/live`, { replace: true });
          return;
        }
        if (next.status === 'expired' || next.status === 'cancelled') {
          sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
          setRideRequest(null);
          toast.info(next.status === 'expired' ? 'No driver accepted in time. Try again.' : 'Ride request cancelled.');
          return;
        }
        setRideRequest(next);
      } catch {
        // Socket may still deliver the match; next poll retries.
      }
    }

    const interval = window.setInterval(refreshRequest, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [navigate, rideRequest]);

  useEffect(() => {
    if (!socket || !rideRequest) return;
    const onStatus = (payload: SocketTripStatus) => {
      if (payload.status === 'assigned' && payload.tripCode) {
        sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
        navigate(`/trips/${payload.tripCode}/live`, { replace: true });
      }
    };
    socket.on('trip:status', onStatus);
    return () => {
      socket.off('trip:status', onStatus);
    };
  }, [navigate, rideRequest, socket]);

  const stage = rideRequest ? 'searching' : pickup && dropoff ? 'choosing' : 'idle';

  async function resolveSearch(field: LocationField, event: FormEvent) {
    event.preventDefault();
    const query = field === 'pickup' ? pickupQuery : dropoffQuery;
    if (query.trim().length < 3) return;
    setResolvingField(field);
    try {
      const place = await geoApi.geocode(query);
      if (field === 'pickup') {
        setPickup(place);
        setPickupQuery(place.address);
      } else {
        setDropoff(place);
        setDropoffQuery(place.address);
      }
      setMapField(field === 'pickup' ? 'dropoff' : 'pickup');
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Could not find that ${field}.`));
    } finally {
      setResolvingField(null);
    }
  }

  async function handleMapClick(point: LatLng) {
    if (!isWithinBangladeshBounds(point)) {
      toast.error(SERVICE_AREA_NOTICE);
      return;
    }
    setResolvingField(mapField);
    try {
      const place = await geoApi.reverseGeocode(point.lat, point.lng);
      if (mapField === 'pickup') {
        setPickup(place);
        setPickupQuery(place.address);
        setMapField('dropoff');
      } else {
        setDropoff(place);
        setDropoffQuery(place.address);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not identify that map point.'));
    } finally {
      setResolvingField(null);
    }
  }

  async function confirmRide() {
    if (!pickup || !dropoff || !selectedCategoryId || cities.length === 0) return;
    setSubmitting(true);
    try {
      const created = await ridesApi.createRequest({
        cityId: cities[0].id,
        categoryId: selectedCategoryId,
        pickup,
        dropoff,
        paymentIntent,
        ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
        womenOnly,
      });
      sessionStorage.setItem(ACTIVE_REQUEST_KEY, created.publicId);
      setRideRequest(created);
      toast.success('Looking for a nearby driver.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not request this ride.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelSearching() {
    if (!rideRequest) return;
    setCancelling(true);
    try {
      await ridesApi.cancelRequest(rideRequest.publicId);
      sessionStorage.removeItem(ACTIVE_REQUEST_KEY);
      setRideRequest(null);
      toast.info('Ride request cancelled.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not cancel the request.'));
    } finally {
      setCancelling(false);
    }
  }

  const mapUserPosition = useMemo(() => geolocation.position
    ? { lat: geolocation.position.lat, lng: geolocation.position.lng }
    : null, [geolocation.position]);

  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden lg:pr-[420px]">
      <ConnectionPill state={connectionState} />
      <MapView
        pickup={pickup}
        dropoff={dropoff}
        user={mapUserPosition}
        onMapClick={rideRequest ? undefined : handleMapClick}
        className="h-full"
      />

      {!rideRequest && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl bg-surface/95 px-3 py-2 text-sm shadow-lg">
          <span className="font-semibold">Map pin: {locationLabel(mapField)}</span>
          <span className="ml-2 text-ink-500">Tap the map to set</span>
        </div>
      )}

      <BottomSheet
        open
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        className="lg:!inset-y-0 lg:!left-auto lg:!right-0 lg:!h-auto lg:!w-[420px] lg:rounded-none lg:border-l lg:border-border"
      >
        {referenceLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton lines={2} />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : referenceError ? (
          <EmptyState title="Ride options did not load" hint={referenceError} action={{ label: 'Retry', onClick: loadReferences }} />
        ) : (
          // Cross-fade between the form/fare-list stage and the searching
          // stage — they differ enough in layout (top-aligned form vs.
          // centered radar) that a shared-element move would look wrong;
          // a plain opacity swap is the "preventing a jarring change" fix
          // (animate skill §2). mode="wait" avoids the two overlapping.
          <AnimatePresence mode="wait">
          {stage === 'searching' && rideRequest ? (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex min-h-full flex-col items-center justify-center gap-4 py-6 text-center"
            >
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-marigold-500/15 motion-safe:animate-pulse">
              <span className="text-3xl" aria-hidden="true">📡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Finding your driver…</h1>
              <p className="mt-1 text-sm text-ink-500">
                {formatBDT(rideRequest.quote.estPayable ?? rideRequest.quote.estFare)} estimated · {rideRequest.quote.estDistanceKm} km
              </p>
            </div>
            <Button variant="danger" loading={cancelling} onClick={cancelSearching} className="w-full">
              Cancel request
            </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="space-y-4 pb-2"
            >
            <div>
              <h1 className="text-xl font-bold">Where are you going?</h1>
              <p className="text-sm text-ink-500">Search an address or tap the map.</p>
            </div>

            <form onSubmit={(event) => resolveSearch('pickup', event)} className="flex items-end gap-2">
              <Input
                label="Pickup"
                value={pickupQuery}
                onChange={(event) => setPickupQuery(event.target.value)}
                placeholder="Current location or address"
                containerClassName="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" loading={resolvingField === 'pickup'} aria-label="Find pickup">Find</Button>
            </form>
            <form onSubmit={(event) => resolveSearch('dropoff', event)} className="flex items-end gap-2">
              <Input
                label="Dropoff"
                value={dropoffQuery}
                onChange={(event) => setDropoffQuery(event.target.value)}
                placeholder="Where to?"
                containerClassName="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" loading={resolvingField === 'dropoff'} aria-label="Find dropoff">Find</Button>
            </form>

            {geolocation.state === 'denied' && (
              <p className="rounded-xl bg-marigold-500/15 p-3 text-sm text-ink-900">
                Location permission is off. Search your pickup or choose it on the map.
              </p>
            )}

            {pickup && dropoff && (
              <>
                <div className="border-t border-border pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">Choose a ride</h2>
                    {quotesLoading && <span className="text-sm text-ink-500">Checking fares…</span>}
                  </div>
                  {quotesLoading ? (
                    <div className="space-y-2">
                      <Skeleton variant="card" />
                      <Skeleton variant="card" />
                    </div>
                  ) : quoteError ? (
                    <EmptyState title="No fares available" hint={quoteError} className="py-6" />
                  ) : (
                    <div className="space-y-2">
                      {categories.filter((category) => quotes[category.id]).map((category, index) => (
                        <div key={category.id} className="animate-stagger-in" style={staggerStyle(index)}>
                          <FareEstimateCard
                            category={category}
                            quote={quotes[category.id]}
                            selected={category.id === selectedCategoryId}
                            onSelect={() => setSelectedCategoryId(category.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm font-medium text-ink-900">
                    Payment
                    <select
                      value={paymentIntent}
                      onChange={(event) => setPaymentIntent(event.target.value as PaymentIntent)}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
                    >
                      <option value="cash">Cash</option>
                      <option value="wallet">Wallet</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="card">Card</option>
                    </select>
                  </label>
                  <Input label="Promo (optional)" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} />
                </div>

                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={womenOnly}
                    onChange={(event) => setWomenOnly(event.target.checked)}
                    className="h-5 w-5 accent-cholo-700"
                  />
                  Women-only driver preference
                </label>

                <Button
                  className="w-full"
                  loading={submitting}
                  disabled={!selectedQuote || !selectedCategory}
                  onClick={confirmRide}
                >
                  {selectedQuote && selectedCategory
                    ? `Confirm ${selectedCategory.name} — ${formatBDT(selectedQuote.totalFare)}`
                    : 'Choose a ride'}
                </Button>
              </>
            )}
            </motion.div>
          )}
          </AnimatePresence>
        )}
      </BottomSheet>
    </main>
  );
}
