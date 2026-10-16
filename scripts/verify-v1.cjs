// Run against a configured local server. Only creates/deletes its own random test users.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { openDriver } = require('./db-config.cjs')
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
const testEmails = []
function client() {
  const cookies = new Map()
  return async (route, options = {}) => {
    const response = await fetch(base + route, {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(60000),
      headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '), ...options.headers },
    })
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0], index = pair.indexOf('=')
      cookies.set(pair.slice(0,index), pair.slice(index+1))
    }
    return response
  }
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
async function main() {
  const guest = client(), a = client(), b = client()
  for (const route of ['/', '/recommendations', '/login', '/register']) {
    assert.equal((await guest(route)).status, 200); console.log(`PASS page ${route}`)
  }
  const movies = await (await guest('/api/movies?limit=100')).json()
  assert.ok(movies.movies.length > 1, 'Seed or import at least two movies')
  const movie = movies.movies[0]
  assert.ok(movie.id != null && movie.imageUrl)
  const image = await fetch(new URL(movie.imageUrl, base), { signal: AbortSignal.timeout(20000) })
  assert.equal(image.status, 200); console.log('PASS movies, metadata and image response')
  const search = await (await guest('/api/movies?search=' + encodeURIComponent(movie.title))).json()
  assert.ok(search.movies.some(m => m.id === movie.id)); console.log('PASS search')
  if (movie.genre.length) {
    const genres = await (await guest('/api/movies?genre=' + encodeURIComponent(movie.genre[0]))).json()
    assert.ok(genres.movies.length && genres.movies.every(m => m.genre.includes(movie.genre[0])))
    console.log('PASS genre filter')
  }
  assert.equal((await guest('/api/ratings', json('POST', {movieId: movie.id, rating:5}))).status, 401)
  assert.equal((await guest('/api/bookmarks', json('POST', {movieId:movie.id}))).status, 401)
  assert.equal((await guest('/profile')).status, 307)
  assert.equal((await guest('/bookmarks')).status, 307)
  console.log('PASS anonymous writes rejected')
  const badDomain = await guest('/api/auth/register', json('POST', {
    name: 'Invalid domain test', email: 'cinelink-test@example.invalid', password: randomUUID(),
  }))
  assert.equal(badDomain.status, 400)
  console.log('PASS nonexistent email domain rejected')
  for (const request of [a,b]) {
    // Synthetic accounts; no email is sent. Domain must have MX records.
    const email = `cinelink-test-${randomUUID()}@${process.env.TEST_EMAIL_DOMAIN || 'gmail.com'}`, password = randomUUID()
    testEmails.push(email)
    assert.equal((await request('/api/auth/register', json('POST', {name:'CineLink automated test', email,password}))).status, 200)
    const { csrfToken } = await (await request('/api/auth/csrf')).json()
    const login = await request('/api/auth/callback/credentials', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},
      body:new URLSearchParams({csrfToken,email,password,callbackUrl:base}),
    })
    assert.ok([200,302].includes(login.status))
    assert.equal((await (await request('/api/auth/session')).json()).user.email,email)
    assert.equal((await request('/profile')).status,200)
    assert.equal((await request('/bookmarks')).status,200)
  }
  console.log('PASS registration and credentials login for two isolated users')
  assert.equal((await a('/api/ratings',json('POST',{movieId:movie.id,rating:5}))).status,200)
  assert.ok((await (await a('/api/ratings')).json()).ratings.some(r=>r.movieId===movie.id && r.rating===5))
  assert.equal((await (await b('/api/ratings')).json()).ratings.length,0)
  assert.equal((await a('/api/bookmarks',json('POST',{movieId:movie.id}))).status,200)
  assert.ok((await (await a('/api/bookmarks')).json()).bookmarkedIds.includes(movie.id))
  assert.equal((await (await b('/api/bookmarks')).json()).bookmarkedIds.length,0)
  assert.equal((await a('/api/bookmarks',json('POST',{movieId:2147483647}))).status,404)
  console.log('PASS persisted ratings/bookmarks, isolation and missing-movie rejection')
  for (let i=0;i<2;i++) {
    const result=await (await a('/api/recommendations',json('POST',{userRatings:[]}))).json()
    assert.ok(result.recommendations.length>0)
    assert.ok(result.recommendations.every(m=>m.id!==movie.id))
  }
  console.log('PASS personalized recommendations and refresh exclude seen movie')
  assert.equal((await a('/api/bookmarks',json('DELETE',{movieId:movie.id}))).status,200)
  assert.equal((await a('/api/ratings',json('POST',{movieId:movie.id,rating:0}))).status,200)
  const {csrfToken}=await (await a('/api/auth/csrf')).json()
  await a('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,callbackUrl:base})})
  assert.ok(!(await (await a('/api/auth/session')).json())?.user)
  assert.equal((await a('/api/ratings',json('POST',{movieId:movie.id,rating:4}))).status,401)
  console.log('PASS removal, logout and session invalidation')
}
main().catch(error=>{console.error('FAIL integration:',error.message);process.exitCode=1}).finally(async()=>{
  if (!testEmails.length) return
  const driver=openDriver(), session=driver.session()
  try {await session.run('MATCH (u:User) WHERE u.email IN $emails DETACH DELETE u',{emails:testEmails});console.log('Cleaned only test-owned users and relationships')}
  finally {await session.close();await driver.close()}
})
