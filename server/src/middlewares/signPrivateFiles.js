import { signPrivateRefs } from '../services/storage.service.js';

export function signPrivateFiles(_request, response, next) {
  const json = response.json.bind(response);
  response.json = (body) => json(signPrivateRefs(body));
  next();
}
