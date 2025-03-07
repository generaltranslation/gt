const { getGT } = require('gt-next/server');
const { getGT: gTTest } = require('gt-next/server');

const temp = require('gt-next/server');
const gtTest2 = temp.getGT;

const { useGT } = require('gt-react');

export default async function TestStrings() {
  const tx = await getGT();
  const tx2 = await gTTest();
  const tx3 = await gtTest2();

  tx('cjsstring1', { id: 'cjsstring1' });
  tx2('cjsstring2', { id: 'cjsstring2' });
  tx3('cjsstring3', { id: 'cjsstring3' });
}
export function TestStrings2() {
  const tx = useGT();
  tx('cjsstringasync1', { id: 'cjsstringasync1' });
}
