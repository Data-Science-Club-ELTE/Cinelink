import sys,unittest,tempfile,csv,subprocess,json
from pathlib import Path
sys.path.insert(0,'/mnt/data/cinelink_task')
from map_movielens_tmdb import audit,clean_id

def m(id,title='Movie'): return dict(movieId=str(id),title=title,genres='Drama')
def l(id,tid): return dict(movieId=str(id),imdbId='123',tmdbId=str(tid))
class Tests(unittest.TestCase):
 def test_clean(self):
  self.assertEqual(clean_id(' 0012 '),'12');self.assertEqual(clean_id('-1'),'');self.assertEqual(clean_id('abc'),'')
 def test_missing(self):
  r,s=audit([m(1),m(2)],[l(1,5)]);self.assertEqual([x['status'] for x in r],['mapped','missing_link'])
 def test_invalid(self):
  r,s=audit([m(1),m(2)],[l(1,''),l(2,'x')]);self.assertEqual(s['status_counts']['missing_or_invalid_tmdb_id'],2)
 def test_ambiguous(self):
  r,s=audit([m(1)],[l(1,3),l(1,4)]);self.assertEqual(r[0]['status'],'ambiguous_tmdb_id')
 def test_duplicate_links(self):
  r,s=audit([m(1)],[l(1,3),l(1,3)]);self.assertEqual(r[0]['status'],'duplicate_link_movie_id')
 def test_duplicate_movies(self):
  r,s=audit([m(1),m(1)],[l(1,3)]);self.assertEqual(s['status_counts']['duplicate_movie_id'],2)
 def test_duplicate_tmdb(self):
  r,s=audit([m(1),m(2)],[l(1,3),l(2,3)]);self.assertEqual(s['status_counts']['duplicate_tmdb_id'],2)
 def test_orphans(self):
  r,s=audit([m(1)],[l(1,3),l(2,4)]);self.assertEqual(s['orphan_link_rows'],1)
 def test_missing_columns(self):
  with self.assertRaises(ValueError):audit([{'movieId':'1'}],[l(1,3)])
 def test_real_data(self):
  with open('/mnt/data/movies.csv',encoding='utf-8-sig') as f:movies=list(csv.DictReader(f))
  with open('/mnt/data/links.csv',encoding='utf-8-sig') as f:links=list(csv.DictReader(f))
  r,s=audit(movies,links)
  self.assertEqual(s['movie_rows'],27278);self.assertEqual(s['usable_mappings'],26991);self.assertEqual(s['coverage_percent'],98.95)
 def test_cli(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)
   for name,rows in [('movies.csv',[m(1)]),('links.csv',[l(1,99)])]:
    with (p/name).open('w',newline='') as f:
     w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
   res=subprocess.run([sys.executable,'/mnt/data/cinelink_task/map_movielens_tmdb.py',str(p/'movies.csv'),str(p/'links.csv'),'--output',str(p/'out')],capture_output=True,text=True)
   self.assertEqual(res.returncode,0,res.stderr)
   self.assertEqual(json.loads((p/'out/mapping_coverage.json').read_text())['usable_mappings'],1)
if __name__=='__main__':unittest.main(verbosity=2)
