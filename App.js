import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, StatusBar, Switch, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dow = (d = new Date()) => (d.getDay() + 6) % 7;
const dn = (i, k, t) => !!(i.done && (i.done[k] || (t && i.done[k + '@' + t])));
const isDone = (i, k) => (i.times.length ? i.times.every((t) => dn(i, k, t)) : dn(i, k));
function streak(i) {
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
    const ch = `hat_${S.sound ? 1 : 0}${S.vib ? 1 : 0}`;
    for (const i of items) for (const d of i.days) for (const t of i.times) {
      const [h, m] = t.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: { title: '⏰ ' + i.name, body: 'Zamanı geldi · ' + t, sound: S.sound ? 'default' : undefined },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: ((d + 1) % 7) + 1, hour: h, minute: m, channelId: ch },
      });
    }
  } catch (e) {}
}

export default function App() {
  const scheme = useColorScheme();
  const [items, setItems] = useState([]);
  const [S, setS] = useState({ name: 'Düzenli Hatırlatıcı', sound: true, vib: true, theme: 'auto' });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('main');
  const [perm, setPerm] = useState('?');
  const [f, setF] = useState({ name: '', hh: '09', mm: '00', times: [], days: [0, 1, 2, 3, 4, 5, 6], editId: null });
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
      }
      try { const r = await Notifications.requestPermissionsAsync(); setPerm(r.status); } catch (e) {}
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (ready) { AsyncStorage.setItem('hat_items', JSON.stringify(items)); schedule(items, S); } }, [items, S.sound, S.vib, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem('hat_set', JSON.stringify(S)); }, [S, ready]);

  const k = dkey(), w = dow();
  const upd = (i, done) => setItems(items.map((x) => (x.id === i.id ? { ...x, done } : x)));
  const toggleTime = (i, t) => { const cur = dn(i, k, t); const d = { ...i.done, [k + '@' + t]: !cur }; if (cur) d[k] = false; upd(i, d); };
  const toggleAll = (i) => { const all = isDone(i, k); const d = { ...i.done, [k]: false }; i.times.forEach((t) => (d[k + '@' + t] = !all)); upd(i, d); };
  const addTime = () => {
    const h = +f.hh, m = +f.mm;
    if (!(f.hh !== '' && f.mm !== '' && h >= 0 && h < 24 && m >= 0 && m < 60)) return Alert.alert('Saat geçersiz', 'Saat 0-23, dakika 0-59 olmalı.');
    const t = `${pad(h)}:${pad(m)}`;
    if (!f.times.includes(t)) setF({ ...f, times: [...f.times, t].sort() });
  };
  const resetForm = () => setF({ name: '', hh: '09', mm: '00', times: [], days: [0, 1, 2, 3, 4, 5, 6], editId: null });
  const save = () => {
    const n = f.name.trim();
    if (!n) return Alert.alert('Madde adı gerekli');
    if (!f.days.length) return Alert.alert('En az bir gün seç');
    if (!f.times.length) return Alert.alert('En az bir saat ekle', 'Saati yazıp "+ Saat ekle"ye dokun.');
    const days = [...f.days].sort(), times = [...f.times].sort();
    if (f.editId) setItems(items.map((x) => (x.id === f.editId ? { ...x, name: n, days, times } : x)));
    else setItems([...items, { id: Date.now(), name: n, days, times, done: {} }]);
    resetForm();
  };
  const edit = (i) => { setF({ name: i.name, hh: '09', mm: '00', times: [...i.times], days: [...i.days], editId: i.id }); setTab('main'); };
  const del = (i) => Alert.alert('Silinsin mi?', i.name, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => setItems(items.filter((x) => x.id !== i.id)) }]);
  const testNotif = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: '⏰ Test', body: 'Bildirimler çalışıyor.', sound: S.sound ? 'default' : undefined },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: `hat_${S.sound ? 1 : 0}${S.vib ? 1 : 0}` },
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
                  <Text style={{ color: d ? '#fff' : late ? c.warn : c.tx, fontSize: 13 }}>{d ? '✓ ' : late ? '⏳ ' : ''}{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={st.mut}>{i.days.length === 7 ? 'Her gün' : i.days.map((d) => DN[d]).join(', ')}{sk ? ` · 🔥 ${sk} gün seri` : ''}</Text>
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
      const kk = dkey(d), sc = items.filter((i) => i.days.includes(dow(d))), n = sc.filter((i) => isDone(i, kk)).length, p = sc.length ? Math.round((n / sc.length) * 100) : 0;
      tot += sc.length; dd += n;
      r.push(<View key={o} style={{ flex: 1, alignItems: 'center' }}><View style={{ height: 100, justifyContent: 'flex-end', width: '100%' }}><View style={{ height: Math.max(p, 3), backgroundColor: c.ac, borderRadius: 6 }} /></View><Text style={st.mut}>{sc.length ? p + '%' : '–'}</Text><Text style={st.mut}>{DN[dow(d)]}</Text></View>);
    }
    return { r, tot, dd };
  };

  const tabs = [['main', '📋 Ana sayfa'], ['stats', '📊 İstatistik'], ['set', '⚙️ Ayarlar']];
  const td = items.filter((i) => i.days.includes(w)), ot = items.filter((i) => !i.days.includes(w));

  return (
    <View style={st.root}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Text style={st.h1}>⏰ {S.name}</Text>
      <Text style={st.mut}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <View style={st.tabs}>{tabs.map(([id, n]) => <TouchableOpacity key={id} onPress={() => setTab(id)} style={[st.tab, tab === id && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: tab === id ? '#fff' : c.tx, fontSize: 13 }}>{n}</Text></TouchableOpacity>)}</View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
        {tab === 'main' && (<>
          <View style={st.card}>
            <TextInput style={st.input} placeholder="Ne yapmak istiyorsun? (örn. Su iç, İlaç)" placeholderTextColor={c.mut} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={80} />
            <View style={st.row}>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.hh} onChangeText={(v) => setF({ ...f, hh: v })} />
              <Text style={{ color: c.tx, fontWeight: '700' }}>:</Text>
              <TextInput style={[st.input, { width: 64, textAlign: 'center' }]} keyboardType="number-pad" maxLength={2} value={f.mm} onChangeText={(v) => setF({ ...f, mm: v })} />
              <TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={addTime}><Text style={{ color: c.tx }}>+ Saat ekle</Text></TouchableOpacity>
            </View>
            <View style={st.chips}>{f.times.map((t) => <TouchableOpacity key={t} style={st.chip} onPress={() => setF({ ...f, times: f.times.filter((x) => x !== t) })}><Text style={{ color: c.tx, fontSize: 13 }}>{t}  <Text style={{ color: c.danger }}>✕</Text></Text></TouchableOpacity>)}</View>
            <View style={[st.row, { justifyContent: 'space-between' }]}>{DN.map((n, i) => { const on = f.days.includes(i); return <TouchableOpacity key={n} onPress={() => setF({ ...f, days: on ? f.days.filter((x) => x !== i) : [...f.days, i] })} style={[st.day, on && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: on ? '#fff' : c.tx, fontSize: 11 }}>{n}</Text></TouchableOpacity>; })}</View>
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
          </View>
          <View style={st.card}><Text style={st.name}>🎨 Tema</Text><View style={st.chips}>{[['auto', 'Otomatik'], ['light', 'Parlak'], ['dark', 'Koyu']].map(([id, n]) => <TouchableOpacity key={id} onPress={() => setS({ ...S, theme: id })} style={[st.chip, { paddingVertical: 9, paddingHorizontal: 14 }, S.theme === id && { backgroundColor: c.ac, borderColor: c.ac }]}><Text style={{ color: S.theme === id ? '#fff' : c.tx }}>{n}</Text></TouchableOpacity>)}</View></View>
          <View style={st.card}>
            <Text style={st.name}>🔔 Bildirimler</Text>
            <Text style={st.mut}>İzin durumu: {perm === 'granted' ? 'verildi ✓' : perm}</Text>
            <View style={st.row}><TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={askPerm}><Text style={{ color: c.tx }}>İzin iste</Text></TouchableOpacity><TouchableOpacity style={[st.btn, st.sec, { flex: 1 }]} onPress={testNotif}><Text style={{ color: c.tx }}>Test (5 sn)</Text></TouchableOpacity></View>
            <Text style={st.mut}>Bildirim gelmezse telefon ayarlarından bu uygulama için pil kısıtlamasını kaldır ve "Alarmlar ve hatırlatıcılar" iznini aç.</Text>
          </View>
          <View style={st.card}><TouchableOpacity onPress={() => Alert.alert('Tüm veriler silinsin mi?', '', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => { setItems([]); setS({ name: 'Düzenli Hatırlatıcı', sound: true, vib: true, theme: 'auto' }); } }])}><Text style={{ color: c.danger, textAlign: 'center' }}>🗑 Tüm verileri sil</Text></TouchableOpacity></View>
          <View style={st.card}><Text style={[st.mut, { textAlign: 'center' }]}>Credit</Text><Text style={{ color: c.tx, textAlign: 'center', fontWeight: '700', fontSize: 17, marginTop: 4 }}>Alikemal ApexGamer</Text></View>
        </>)}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, paddingTop: (StatusBar.currentHeight || 44) + 8, paddingHorizontal: 16 },
  h1: { color: c.tx, fontSize: 22, fontWeight: '700' }, h2: { color: c.tx, fontSize: 15, fontWeight: '700', marginVertical: 10 },
  mut: { color: c.mut, fontSize: 12, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 6, marginVertical: 12 },
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
