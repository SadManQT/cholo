import { signPrivateRefs } from '../services/storage.service.js';

// Driver and admin responses carry document refs ("private://documents/…"); swap each for a signed link.
export function signPrivateFiles(_request, response, next) {
  const json = response.json.bind(response);
  response.json = (body) => json(signPrivateRefs(body));
  next();
}
