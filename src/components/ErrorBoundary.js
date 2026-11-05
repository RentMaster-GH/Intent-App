import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(){ return { hasError: true }; }
  componentDidCatch(e){ console.log('INTENT Crash:', e); }
  render(){
    if(this.state.hasError) return (
      <View style={styles.c}><Text style={styles.t}>INTENT</Text><Text style={styles.sub}>Oops — something broke. Don't worry, your 3 chats are safe.</Text>
      <TouchableOpacity style={styles.btn} onPress={()=>window.location.reload()}><Text style={styles.btnText}>Reload Intent ↻</Text></TouchableOpacity></View>
    );
    return this.props.children;
  }
}
const styles = StyleSheet.create({
  c:{flex:1,backgroundColor:'#0F172A',justifyContent:'center',alignItems:'center',padding:24},
  t:{fontSize:28,fontWeight:'900',color:'#F8FAFC',letterSpacing:4},
  sub:{color:'#94A3B8',textAlign:'center',marginTop:12,lineHeight:20},
  btn:{backgroundColor:'#F97316',paddingHorizontal:20,paddingVertical:12,borderRadius:12,marginTop:20},
  btnText:{color:'#FFF',fontWeight:'800'}
});