import psycopg2
conn = psycopg2.connect("host=127.0.0.1 dbname=fgs_vote user=postgres password=postgres")
cur = conn.cursor()

for table in ['votes', 'vote_candidates']:
    cur.execute(f"""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name='{table}'
    ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    print(f"\n=== {table} ===")
    for c in cols:
        print(f"  {c[0]} ({c[1]}, nullable={c[2]})")

cur.execute("SELECT * FROM votes LIMIT 5")
rows = cur.fetchall()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='votes' ORDER BY ordinal_position")
vcols = [r[0] for r in cur.fetchall()]
print("\n=== votes data (first 5) ===")
for row in rows:
    print(f"  {dict(zip(vcols, row))}")

cur.execute("SELECT * FROM vote_candidates LIMIT 10")
rows = cur.fetchall()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='vote_candidates' ORDER BY ordinal_position")
vc_cols = [r[0] for r in cur.fetchall()]
print("\n=== vote_candidates data (first 10) ===")
for row in rows:
    print(f"  {dict(zip(vc_cols, row))}")

conn.close()
