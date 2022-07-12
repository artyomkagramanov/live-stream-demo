import React from 'react';
import Stream from './stream';

function App(props){
   return <Stream username={ 'username' } { ...props } />
}
export default App;
