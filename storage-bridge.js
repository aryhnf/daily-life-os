(() => {
  const pairs = new Map([
    ['daily-os-routine-template-order', 'daily-os-routine-order:template-default'],
    ['daily-os-body-template-order', 'daily-os-routine-order:body-template'],
    ['daily-os-skincare-order-am', 'daily-os-routine-order:skincare-am'],
    ['daily-os-skincare-order-pm', 'daily-os-routine-order:skincare-pm'],
    ['daily-os-weekly-day-types', 'daily-os-routine-order:weekly-day-types']
  ]);
  const reverse = new Map([...pairs].map(([a,b]) => [b,a]));
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;

  function mate(key) { return pairs.get(key) || reverse.get(key) || null; }

  Storage.prototype.setItem = function(key, value) {
    nativeSet.call(this, key, value);
    if (this === localStorage) {
      const other = mate(String(key));
      if (other) nativeSet.call(this, other, value);
    }
  };

  Storage.prototype.removeItem = function(key) {
    nativeRemove.call(this, key);
    if (this === localStorage) {
      const other = mate(String(key));
      if (other) nativeRemove.call(this, other);
    }
  };

  // Reconcile module keys with aliases that are already included by backup/reset.
  try {
    for (const [primary, alias] of pairs) {
      const p = localStorage.getItem(primary);
      const a = localStorage.getItem(alias);
      if (p != null) nativeSet.call(localStorage, alias, p);
      else if (a != null) nativeSet.call(localStorage, primary, a);
    }
  } catch {}
})();
