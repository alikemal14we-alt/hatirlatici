import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, StatusBar, Switch, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dow = (d = new Date()) => (d.getDay() + 6) % 7;
const onDay = (i, d = new Date()) => (i.date ? i.date === dkey(d) : i.days.includes(dow(d)));
const ZILS = [['zil1', 'Klasik'], ['zil2', 'Yumuşak'], ['zil3', 'Dijital'], ['zil4', 'Siren']];
const calDays = (days) => days.map((d) => ((d + 1) % 7) + 1);
const dn = (i, k, t) => !!(i.done && (i.done[k] || (t && i.done[k + '@' + t])));
const isDone = (i, k) => (i.times.length ? i.times.every((t) => dn(i, k, t)) : dn(i, k));
function streak(i) {
  if (i.date) return 0;
  let n = 0, d = new Date();
  if (!isDone(i, dkey(d))) d.setDate(d.getDate() - 1);
  for (let c = 0; c < 400; c++) {
    if (i.days.includes(dow(d))) { if (isDone(i, dkey(d))) n++; else break; }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
const LIGHT = { bg: '#f6f7fb', card: '#ffffff', tx: '#1b1d26', mut: '#6b7080', ac: '#4f6bed', ok: '#22a06b', warn: '#d98a1c', bd: '#e3e6ef', danger: '#d93f4c' };
const DARK = { bg: '#111320', card: '#1b1e30', tx: '#eef0f8', mut: '#9aa0b8', ac: '#7b92ff', ok: '#3ecf94', warn: '#f0a93b', bd: '#2b2f47', danger: '#ff6b78' };

async function schedule(items, S) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const ch = `hat_${S.sound ? 1 : 0}${S.vib ? 1 : 0}`, now = Date.now();
    for (const i of items) for (const t of i.times) {
      const [h, m] = t.split(':').map(Number);
      const zil = (i.rings || []).includes(t), alarm = (i.alarms || []).includes(t);
      const content = { title: (zil ? '🔔 ' : '⏰ ') + i.name, body: (alarm ? 'Alarm saati · ' : 'Zamanı geldi · ') + t, sound: zil ? S.zil + '.wav' : alarm ? undefined : S.sound ? 'default' : undefined, priority: Notifications.AndroidNotificationPriority.MAX };
      const channelId = zil ? 'hat_' + S.zil : alarm ? 'hat_00' : ch;
      if (i.date) {
        const [y, mo, d] = i.date.split('-').map(Number), dt = new Date(y, mo - 1, d, h, m);
        if (dt.getTime() > now) await Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dt, channelId } });
      } else {
        for (const d of i.days) await Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: ((d + 1) % 7) + 1, hour: h, minute: m, channelId } });
      }
    }
  } catch (e) {}
}

export default function App() {
  const scheme = useColorScheme();
  const [items, setItems] = useState([]);
  const [S, setS] = useState({ name: 'Düzenli Hatırlatıcı', sound: true, vib: true, zil: 'zil1', theme: 'auto' });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('main');
  const [perm, setPerm] = useState('?');
  const [f, setF] = useState({ name: '', hh: '09', mm: '00', times: [], rings: [], alarms: [], mode: 'n', dated: false, dd: '', mo: '', yy: '', days: [0, 1, 2, 3, 4, 5, 6], editId: null });
  const dark = S.theme === 'dark' || (S.theme === 'auto' && scheme === 'dark');
  const c = dark ? DARK : LIGHT;
  const st = useMemo(() => makeStyles(c), [dark]);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await AsyncStorage.multiGet(['hat_items', 'hat_set']);
        if (a[1]) setItems(JSON.parse(a[1]));
        if (b[1]) setS((s) => ({ ...s, ...JSON.parse(b[1]) }));
      } catch (e) {}
      if (Platform.OS === 'android') {
        for (const s of [0, 1]) for (const v of [0, 1]) {
          await Notifications.setNotificationChannelAsync(`hat_${s}${v}`, {
            name: `Hatırlatma${s ? '' : ' (sessiz)'}${v ? '' : ' (titreşimsiz)'}`,
            importance: s ? Notifications.AndroidImportance.MAX : Notifications.AndroidImportance.DEFAULT,
            sound: s ? 'default' : null, enableVibrate: !!v, vibrationPattern: v ? [0, 300, 150, 300] : undefined,
          });
        }
        for (const [zid, zname] of ZILS) await Notifications.setNotificationChannelAsync('hat_' + zid, {
          name: 'Zil · ' + zname, importance: Notifications.AndroidImportance.MAX, sound: zid + '.wav',
          enableVibrate: true, vibrationPattern: [0, 800, 400, 800, 400, 800], bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
        });
      }
      try { const r = await Notifications.requestPermissionsAsync(); setPerm(r.status); } catch (e) {}
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) { AsyncStorage.setItem('hat_items', JSON.stringify(items)); schedule(items, S); } }, [items, S.sound, S.vib, S.zil, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem('hat_set', JSON.stringify(S)); }, [S, ready]);

  const k = dkey(), w = dow();
  const upd = (i, done) => setItems(items.map((x) => (x.id === i.id ? { ...x, done } : x)));
  const toggleTime = (i, t) => { const cur = dn(i, k, t); const d = { ...i.done, [k + '@' + t]: !cur }; if (cur) d[k] = false; upd(i, d); };
  const toggleAll = (i) => { const all = isDone(i, k); const d = { ...i.done, [k]: false }; i.times.forEach((t) => (d[k + '@' + t] = !all)); upd(i, d); };
  const addTime = () => {
    const h = +f.hh, m = +f.mm;
    if (!(f.hh !== '' && f.mm !== '' && h >= 0 && h < 24 && m >= 0 && m < 60)) return Alert.alert('Saat geçersiz', 'Saat 0-23, dakika 0-59 olmalı.');
    const t = `${pad(h)}:${pad(m)}`;
    const rings = f.rings.filter((x) => x !== t), alarms = f.alarms.filter((x) => x !== t);
    if (f.mode === 'z') rings.push(t);
    if (f.mode === 'a') alarms.push(t);
    setF({ ...f, times: f.times.includes(t) ? f.times : [...f.times, t].sort(), rings, alarms });
  };
  const resetForm = () => setF({ name: '', hh: '09', mm: '00', times: [], rings: [], alarms: [], mode: 'n', dated: false, dd: '', mo: '', yy: '', days: [0, 1, 2, 3, 4, 5, 6], editId: null });
  const mkAlarm = async (name, t, days, date) => {
    const [h, m] = t.split(':').map(Number);
    const extra = { 'android.intent.extra.alarm.HOUR': h, 'android.intent.extra.alarm.MINUTES': m, 'android.intent.extra.alarm.MESSAGE': name, 'android.intent.extra.alarm.SKIP_UI': true };
    if (!date) extra['android.intent.extra.alarm.DAYS'] = calDays(days);
    try { await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', { extra }); return true; } catch (e) { return false; }
  };
  const save = async () => {
    const n = f.name.trim();
    if (!n) return Alert.alert('Madde adı gerekli');
    if (!f.times.length) return Alert.alert('En az bir saat ekle', 'Saati yazıp "+ Saat ekle"ye dokun.');
    let date = null;
    if (f.dated) {
      const y = +f.yy, mo = +f.mo, d = +f.dd, dt = new Date(y, mo - 1, d);
      if (!(y > 2000 && dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d)) return Alert.alert('Tarih geçersiz', 'Gün, ay ve yılı sayı olarak yaz (örn. 12 / 11 / 2026).');
      date = dkey(dt);
    } else if (!f.days.length) return Alert.alert('En az bir gün seç');
    const days = date ? [] : [...f.days].sort(), times = [...f.times].sort();
    let rings = f.rings.filter((x) => times.includes(x)), alarms = f.alarms.filter((x) => times.includes(x));
    if (date && alarms.length) {
      const t0 = new Date(), tm = new Date(); tm.setDate(t0.getDate() + 1);
      if (date !== dkey(t0) && date !== dkey(tm)) { rings = [...rings, ...alarms]; alarms = []; Alert.alert('Alarm sadece bugün/yarın için kurulabilir', 'Bu saatler zil olarak ayarlandı.'); }
    }
    const old = f.editId ? items.find((x) => x.id === f.editId) : null;
    const made = [...((old && old.made) || [])], bad = [];
    let ok = 0;
    for (const t of alarms) {
      const sig = `${t}|${days.join('')}|${date || ''}`;
      if (made.includes(sig)) continue;
      if (await mkAlarm(n, t, days, date)) { made.push(sig); ok++; } else bad.push(t);
    }
    if (bad.length) { rings = [...rings, ...bad]; alarms = alarms.filter((x) => !bad.includes(x)); Alert.alert('Alarm kurulamadı', 'Saat uygulaması isteği kabul etmedi. Bu saatler zil olarak ayarlandı.'); }
    if (ok) Alert.alert('Telefon alarmı kuruldu', 'Saat uygulamanda kontrol et. Tekrar günleri bazı telefonlarda uygulanmayabilir. Silmek için alarmı saat uygulamasından kaldırman gerekir.');
    const item = { name: n, days, times, rings, alarms, made, date };
    if (f.editId) setItems(items.map((x) => (x.id === f.editId ? { ...x, ...item } : x)));
    else setItems([...items, { id: Date.now(), done: {}, ...item }]);
    resetForm();
  };
  const edit = (i) => { setF({ name: i.name, hh: '09', mm: '00', times: [...i.times], rings: [...(i.rings || [])], alarms: [...(i.alarms || [])], mode: 'n', dated: !!i.date, dd: i.date ? String(+i.date.slice(8)) : '', mo: i.date ? String(+i.date.slice(5, 7)) : '', yy: i.date ? i.date.slice(0, 4) : '', days: i.days.length ? [...i.days] : [0, 1, 2, 3, 4, 5, 6], editId: i.id }); setTab('main'); };
  const del = (i) => Alert.alert('Silinsin mi?', (i.alarms || []).length ? i.name + '\n\nTelefon saatindeki alarmı ayrıca silmelisin.' : i.name, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => setItems(items.filter((x) => x.id !== i.id)) }]);
  const testNotif = async (ring) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: ring ? '🔔 Zil testi' : '⏰ Test', body: ring ? 'Zil çalıyor.' : 'Bildirimler çalışıyor.', sound: ring ? S.zil + '.wav' : S.sound ? 'default' : undefined },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: ring ? 'hat_' + S.zil : `hat_${S.sound ? 1 : 0}${S.vib ? 1 : 0}` },
      });
      Alert.alert('5 saniye sonra bildirim gelecek', 'Uygulamayı kapatıp bekleyebilirsin.');
    } catch (e) { Alert.alert('Hata', String(e)); }
  };
  const askPerm = async () => { const r = await Notifications.requestPermissionsAsync(); setPerm(r.status); };

  const card = (i, today) => {
    const now = new Date(), hm = pad(now.getHours()) + ':' + pad(now.getMinutes()), on = today && isDone(i, k), sk = streak(i);
    return (
      <View key={i.id} style={[st.card, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        {today && <TouchableOpacity onPress={() => toggleAll(i)} style={[st.chk, on && { backgroundColor: c.ok, borderColor: c.ok }]}><Text style={{ color: '#fff' }}>{on ? '✓' : ''}</Text></TouchableOpacity>}
        <View style={{ flex: 1, marginLeft: today ? 12 : 0 }}>
          <Text style={st.name}>{i.name}</Text>
          <View style={st.chips}>
            {i.times.map((t) => {
              const d = today && dn(i, k, t), late = today && !d && t < hm;
              return (
                <TouchableOpacity key={t} disabled={!today} onPress={() => toggleTime(i, t)} style={[st.chip, d && { backgroundColor: c.ok, borderColor: c.ok }, late && { borderColor: c.warn }]}>
                  <Text style={{ color: d ? '#fff' : late ? c.warn : c.tx, fontSize: 13 }}>{d ? '✓ ' : late ? '⏳ ' : ''}{(i.rings || []).includes(t) ? '🔔 ' : (i.alarms || []).includes(t) ? '⏰ ' : ''}{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={st.mut}>{i.date ? '📅 ' + i.date.split('-').reverse().join('.') : i.days.length === 7 ? 'Her gün' : i.days.map((d) => DN[d]).join(', ')}{sk ? ` · 🔥 ${sk} gün seri` : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => edit(i)}><Text style={st.ib}>✏️</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => del(i)}><Text style={st.ib}>🗑</Text></TouchableOpacity>
      </View>
    );
  };

  const bars = () => {
    let tot = 0, dd = 0; const r = [];
    for (let o = 6; o >= 0; o--) {
      const d = new Date(); d.setDate(d.getDate() - o);
      const kk = dkey(d), sc = items.filter((i) => onDay(i, d)), n = sc.filter((i) => isDone(i, kk)).length, p = sc.length ? Math.round((n / sc.length) * 100) : 0;
      tot += sc.length; dd += n;
      r.push(<View key={o} style={{ flex: 1, alignItems: 'center' }}><View style={{ height: 100, justifyContent: 'flex-end', width: '100%' }}><View style={{ height: Math.max(p, 3), backgroundColor: c.ac, borderRadius: 6 }} /></View><Text style={st.mut}>{sc.length ? p + '%' : '–'}</Text><Text style={st.mut}>{DN[dow(d)]}</Text></View>);
    }
    return { r, tot, dd };
  };

  const tabs = [['main', '📋', 'Ana sayfa'], ['stats', '📊', 'İstatistik'], ['set', '⚙️', 'Ayarlar']];
  const td = items.filter((i) => onDay(i)), ot = items.filter((i) => !onDay(i));

  return (
    <View style={st.root}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Text style={st.h1}>⏰ {S.name}</Text>
      <Text style={st.mut}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {tab === 'main' && (<>
          <View style={st.card}>
            <TextInput style={st.input} placeholder="Ne yapmak istiyorsun? (örn. Su iç, İlaç)" placeholderTextColor={c.mut} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={80} />
            <View style={st.chips}>{[['n', '🔕 Bildirim'], ['z', '🔔 Zil'], ['a', '⏰ Telefon alarmı']].map(([id, n]) => <TouchableOpacity key={id} onPress={() => setF({ ...f, mode: id })} style={[st.chip, { paddingVertical: 8 }, f.mode === id && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: f.mode === id ? '#fff' : c.tx, fontSize: 13 }}>{n}</Text></TouchableOpacity>)}</View>
            <Text style={st.mut}>Seçili tür, aşağıdan eklediğin saate uygulanır.</Text>
            <View style={st.row}>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.hh} onChangeText={(v) => setF({ ...f, hh: v })} />
              <Text style={{ color: c.tx, fontWeight: '700' }}>:</Text>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.mm} onChangeText={(v) => setF({ ...f, mm: v })} />
              <TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={addTime}><Text style={{ color: c.tx }}>+ Saat ekle</Text></TouchableOpacity>
            </View>
            <View style={st.chips}>{f.times.map((t) => <TouchableOpacity key={t} style={st.chip} onPress={() => setF({ ...f, times: f.times.filter((x) => x !== t), rings: f.rings.filter((x) => x !== t), alarms: f.alarms.filter((x) => x !== t) })}><Text style={{ color: c.tx, fontSize: 13 }}>{f.rings.includes(t) ? '🔔 ' : f.alarms.includes(t) ? '⏰ ' : ''}{t}  <Text style={{ color: c.danger }}>✕</Text></Text></TouchableOpacity>)}</View>
            {!f.dated && <View style={[st.row, { justifyContent: 'space-between' }]}>{DN.map((n, i) => { const on = f.days.includes(i); return <TouchableOpacity key={n} onPress={() => setF({ ...f, days: on ? f.days.filter((x) => x !== i) : [...f.days, i] })} style={[st.day, on && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: on ? '#fff' : c.tx, fontSize: 11 }}>{n}</Text></TouchableOpacity>; })}</View>}
            <View style={[st.row, { justifyContent: 'space-between' }]}><Text style={{ color: c.tx, flex: 1 }}>📅 Tek seferlik (tarihli)</Text><Switch value={f.dated} onValueChange={(v) => { const n = new Date(); setF({ ...f, dated: v, dd: String(n.getDate()), mo: String(n.getMonth() + 1), yy: String(n.getFullYear()) }); }} /></View>
            {f.dated && <View style={st.row}>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.dd} onChangeText={(v) => setF({ ...f, dd: v })} placeholder="gün" placeholderTextColor={c.mut} />
              <Text style={{ color: c.tx }}>/</Text>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.mo} onChangeText={(v) => setF({ ...f, mo: v })} placeholder="ay" placeholderTextColor={c.mut} />
              <Text style={{ color: c.tx }}>/</Text>
              <TextInput style={[st.input, { width: 84, textAlign: 'center' }]} keyboardType="number-pad" maxLength={4} value={f.yy} onChangeText={(v) => setF({ ...f, yy: v })} placeholder="yıl" placeholderTextColor={c.mut} />
            </View>}
            <View style={st.row}>
              <TouchableOpacity style={[st.btn, { flex: 1 }]} onPress={save}><Text style={st.btnT}>{f.editId ? 'Güncelle' : 'Kaydet'}</Text></TouchableOpacity>
              {f.editId && <TouchableOpacity style={[st.btn, st.sec]} onPress={resetForm}><Text style={{ color: c.tx }}>İptal</Text></TouchableOpacity>}
            </View>
          </View>
          <Text style={st.h2}>Bugün</Text>
          {td.length ? td.map((i) => card(i, true)) : <Text style={[st.mut, { textAlign: 'center', padding: 16 }]}>Bugün için madde yok.</Text>}
          {ot.length > 0 && <Text style={st.h2}>Diğer günler</Text>}
          {ot.map((i) => card(i, false))}
        </>)}
        {tab === 'stats' && (() => { const b = bars(); return (<>
          <View style={st.card}><Text style={st.name}>Son 7 gün</Text><Text style={st.mut}>{b.tot ? `${b.dd}/${b.tot} tamamlandı (%${Math.round((b.dd / b.tot) * 100)})` : 'Henüz veri yok.'}</Text><View style={[st.row, { alignItems: 'flex-end' }]}>{b.r}</View></View>
          <View style={st.card}><Text style={st.name}>🔥 Seriler</Text>{items.map((i) => <View key={i.id} style={[st.row, { justifyContent: 'space-between' }]}><Text style={{ color: c.tx, flex: 1 }}>{i.name}</Text><Text style={{ color: c.tx, fontWeight: '700' }}>🔥 {streak(i)} gün</Text></View>)}</View>
        </>); })()}
        {tab === 'set' && (<>
          <View style={st.card}><Text style={st.name}>✏️ Uygulama adı</Text><TextInput style={[st.input, { marginTop: 10 }]} value={S.name} maxLength={30} onChangeText={(v) => setS({ ...S, name: v || 'Düzenli Hatırlatıcı' })} /></View>
          <View style={st.card}>
            <View style={[st.row, { justifyContent: 'space-between', marginTop: 0 }]}><Text style={{ color: c.tx }}>🔊 Bildirim sesi</Text><Switch value={S.sound} onValueChange={(v) => setS({ ...S, sound: v })} /></View>
            <View style={[st.row, { justifyContent: 'space-between' }]}><Text style={{ color: c.tx }}>📳 Titreşim</Text><Switch value={S.vib} onValueChange={(v) => setS({ ...S, vib: v })} /></View>
            <Text style={st.mut}>Ses ve titreşim değişince hatırlatmalar yeniden kurulur.</Text>
            <Text style={[st.name, { marginTop: 14 }]}>🔔 Zil sesi</Text>
            <View style={st.chips}>{ZILS.map(([id, n]) => <TouchableOpacity key={id} onPress={() => setS({ ...S, zil: id })} style={[st.chip, { paddingVertical: 9, paddingHorizontal: 14 }, S.zil === id && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: S.zil === id ? '#fff' : c.tx }}>{n}</Text></TouchableOpacity>)}</View>
            <Text style={st.mut}>Seçince alttaki "🔔 Zil testi" ile dinleyebilirsin.</Text>
          </View>
          <View style={st.card}><Text style={st.name}>🎨 Tema</Text><View style={st.chips}>{[['auto', 'Otomatik'], ['light', 'Parlak'], ['dark', 'Koyu']].map(([id, n]) => <TouchableOpacity key={id} onPress={() => setS({ ...S, theme: id })} style={[st.chip, { paddingVertical: 9, paddingHorizontal: 14 }, S.theme === id && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: S.theme === id ? '#fff' : c.tx }}>{n}</Text></TouchableOpacity>)}</View></View>
          <View style={st.card}>
            <Text style={st.name}>🔔 Bildirimler</Text>
            <Text style={st.mut}>İzin durumu: {perm === 'granted' ? 'verildi ✓' : perm}</Text>
            <View style={st.row}><TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={askPerm}><Text style={{ color: c.tx }}>İzin iste</Text></TouchableOpacity><TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={() => testNotif(false)}><Text style={{ color: c.tx }}>Test (5 sn)</Text></TouchableOpacity><TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={() => testNotif(true)}><Text style={{ color: c.tx }}>🔔 Zil testi</Text></TouchableOpacity></View>
            <Text style={st.mut}>Bildirim gelmezse telefon ayarlarından bu uygulama için pil kısıtlamasını kaldır ve "Alarmlar ve hatırlatıcılar" iznini aç.</Text>
          </View>
          <View style={st.card}><TouchableOpacity onPress={() => Alert.alert('Tüm veriler silinsin mi?', '', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => { setItems([]); setS({ name: 'Düzenli Hatırlatıcı', sound: true, vib: true, zil: 'zil1', theme: 'auto' }); } }])}><Text style={{ color: c.danger, textAlign: 'center' }}>🗑 Tüm verileri sil</Text></TouchableOpacity></View>
          <View style={st.card}><Text style={[st.mut, { textAlign: 'center' }]}>Credit</Text><Text style={{ color: c.tx, textAlign: 'center', fontWeight: '700', fontSize: 17, marginTop: 4 }}>Alikemal ApexGamer</Text></View>
        </>)}
      </ScrollView>
      <View style={st.bar}>{tabs.map(([id, ic, n]) => <TouchableOpacity key={id} onPress={() => setTab(id)} style={st.barBtn}><Text style={{ fontSize: 20, opacity: tab === id ? 1 : 0.5 }}>{ic}</Text><Text style={{ color: tab === id ? c.ac : c.mut, fontSize: 12, fontWeight: tab === id ? '700' : '400' }}>{n}</Text></TouchableOpacity>)}</View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: 16 },
  h1: { color: c.tx, fontSize: 22, fontWeight: '700' }, h2: { color: c.tx, fontSize: 15, fontWeight: '700', marginVertical: 10 },
  mut: { color: c.mut, fontSize: 12, marginTop: 6 },
  bar: { flexDirection: 'row', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.bd, marginHorizontal: -16, paddingTop: 8, paddingBottom: Platform.OS === 'android' ? 24 : 18 },
  barBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tab: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.bd, backgroundColor: c.card, alignItems: 'center' },
  card: { backgroundColor: c.card, borderColor: c.bd, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  input: { backgroundColor: c.bg, color: c.tx, borderColor: c.bd, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  btn: { backgroundColor: c.ac, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' }, btnT: { color: '#fff', fontWeight: '600' },
  sec: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.bd },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, borderColor: c.bd, backgroundColor: c.bg },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.bd, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  chk: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: c.bd, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  name: { color: c.tx, fontWeight: '700', fontSize: 16 }, ib: { fontSize: 18, padding: 6 },
});
