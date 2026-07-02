import sqlite3

def check_db():
    conn = sqlite3.connect("backend/autocall.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables:", tables)
    
    for table in tables:
        print(f"\n--- Table: {table} ---")
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [col[1] for col in cursor.fetchall()]
            print("Columns:", columns)
            
            cursor.execute(f"SELECT * FROM {table} LIMIT 10")
            rows = cursor.fetchall()
            for r in rows:
                print(r)
        except Exception as e:
            print("Error reading table:", e)
            
    conn.close()

if __name__ == "__main__":
    check_db()
